use crate::model::cached_group_summaries::CachedGroupSummaries;
use crate::model::direct_chats::DirectChats;
use crate::model::group_chats::GroupChats;
use crate::model::hot_group_exclusions::HotGroupExclusions;
use crate::timer_job_types::TimerJob;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use ic_ledger_types::AccountIdentifier;
use ledger_utils::default_ledger_account;
use model::contacts::Contacts;
use notifications_canister::c2c_push_notification;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::ops::Deref;
use types::{Avatar, CanisterId, ChatId, Cryptocurrency, Cycles, Notification, TimestampMillis, Timestamped, UserId, Version};
use utils::env::Environment;
use utils::regular_jobs::RegularJobs;

mod crypto;
mod governance_clients;
mod group_summaries;
mod guards;
mod lifecycle;
mod model;
mod openchat_bot;
mod queries;
mod regular_jobs;
mod timer_job_types;
mod updates;

pub const BASIC_GROUP_CREATION_LIMIT: u32 = 5;
pub const PREMIUM_GROUP_CREATION_LIMIT: u32 = 40;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
    pub regular_jobs: RegularJobs<Data>,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data, regular_jobs: RegularJobs<Data>) -> RuntimeState {
        RuntimeState { env, data, regular_jobs }
    }

    pub fn is_caller_owner(&self) -> bool {
        self.env.caller() == self.data.owner
    }

    pub fn is_caller_user_index(&self) -> bool {
        self.env.caller() == self.data.user_index_canister_id
    }

    pub fn is_caller_local_user_index(&self) -> bool {
        self.env.caller() == self.data.local_user_index_canister_id
    }

    pub fn is_caller_group_index(&self) -> bool {
        self.env.caller() == self.data.group_index_canister_id
    }

    pub fn is_caller_known_group_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.group_chats.get(&caller.into()).is_some()
    }

    pub fn is_caller_known_bot(&self) -> bool {
        let caller = self.env.caller();
        self.data.direct_chats.get(&caller.into()).map_or(false, |c| c.is_bot)
    }

    pub fn push_notification(&mut self, recipients: Vec<UserId>, notification: Notification) {
        let args = c2c_push_notification::Args {
            recipients,
            authorizer: Some(self.data.local_user_index_canister_id),
            notification_bytes: candid::encode_one(notification).unwrap(),
        };
        ic_cdk::spawn(push_notification_inner(self.data.notifications_canister_id, args));

        async fn push_notification_inner(canister_id: CanisterId, args: c2c_push_notification::Args) {
            let _ = notifications_canister_c2c_client::c2c_push_notification(canister_id, &args).await;
        }
    }

    pub fn metrics(&self) -> Metrics {
        let chat_metrics = self.data.direct_chats.metrics();
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            direct_chats: self.data.direct_chats.len() as u32,
            group_chats: self.data.group_chats.len() as u32,
            groups_created: self.data.group_chats.groups_created(),
            blocked_users: self.data.blocked_users.len() as u32,
            text_messages: chat_metrics.text_messages,
            image_messages: chat_metrics.image_messages,
            video_messages: chat_metrics.video_messages,
            audio_messages: chat_metrics.audio_messages,
            file_messages: chat_metrics.file_messages,
            polls: chat_metrics.polls,
            poll_votes: chat_metrics.poll_votes,
            cycles_messages: chat_metrics.cycles_messages,
            icp_messages: chat_metrics.icp_messages,
            sns1_messages: chat_metrics.sns1_messages,
            ckbtc_messages: chat_metrics.ckbtc_messages,
            chat_messages: chat_metrics.chat_messages,
            deleted_messages: chat_metrics.deleted_messages,
            giphy_messages: chat_metrics.giphy_messages,
            replies: chat_metrics.replies,
            edits: chat_metrics.edits,
            reactions: chat_metrics.reactions,
            created: self.data.user_created,
            last_active: chat_metrics.last_active,
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                notifications: self.data.notifications_canister_id,
                icp_ledger: self.data.ledger_canister_id(&Cryptocurrency::InternetComputer),
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub owner: Principal,
    pub direct_chats: DirectChats,
    pub group_chats: GroupChats,
    pub blocked_users: Timestamped<HashSet<UserId>>,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    // Remove this after next upgrade
    #[serde(skip_deserializing, default = "initialize_ledger_ids")]
    pub ledger_canister_ids: HashMap<Cryptocurrency, CanisterId>,
    pub avatar: Timestamped<Option<Avatar>>,
    pub test_mode: bool,
    #[serde(alias = "is_super_admin")]
    pub is_platform_moderator: bool,
    pub hot_group_exclusions: HotGroupExclusions,
    pub username: String,
    pub bio: String,
    pub cached_group_summaries: Option<CachedGroupSummaries>,
    pub storage_limit: u64,
    pub phone_is_verified: bool,
    pub user_created: TimestampMillis,
    pub pinned_chats: Timestamped<Vec<ChatId>>,
    pub pending_user_principal_migration: Option<Principal>,
    pub suspended: Timestamped<bool>,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub contacts: Contacts,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
}

fn initialize_ledger_ids() -> HashMap<Cryptocurrency, CanisterId> {
    [
        (
            Cryptocurrency::InternetComputer,
            Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap(),
        ),
        (
            Cryptocurrency::SNS1,
            Principal::from_text("zfcdd-tqaaa-aaaaq-aaaga-cai").unwrap(),
        ),
        (
            Cryptocurrency::CKBTC,
            Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap(),
        ),
        (
            Cryptocurrency::CHAT,
            Principal::from_text("2ouva-viaaa-aaaaq-aaamq-cai").unwrap(),
        ),
    ]
    .into_iter()
    .collect()
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        owner: Principal,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        username: String,
        test_mode: bool,
        now: TimestampMillis,
    ) -> Data {
        Data {
            owner,
            direct_chats: DirectChats::default(),
            group_chats: GroupChats::default(),
            blocked_users: Timestamped::default(),
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            notifications_canister_id,
            ledger_canister_ids: initialize_ledger_ids(),
            avatar: Timestamped::default(),
            test_mode,
            is_platform_moderator: false,
            hot_group_exclusions: HotGroupExclusions::default(),
            username,
            bio: "".to_string(),
            cached_group_summaries: None,
            storage_limit: 0,
            phone_is_verified: false,
            user_created: now,
            pinned_chats: Timestamped::default(),
            pending_user_principal_migration: None,
            suspended: Timestamped::default(),
            timer_jobs: TimerJobs::default(),
            contacts: Contacts::default(),
            diamond_membership_expires_at: None,
        }
    }

    pub fn user_index_ledger_account(&self) -> AccountIdentifier {
        default_ledger_account(self.user_index_canister_id)
    }

    pub fn block_user(&mut self, user_id: UserId, now: TimestampMillis) {
        if self.blocked_users.value.insert(user_id) {
            self.blocked_users.timestamp = now;
        }
    }

    pub fn unblock_user(&mut self, user_id: &UserId, now: TimestampMillis) {
        if self.blocked_users.value.remove(user_id) {
            self.blocked_users.timestamp = now;
        }
    }

    pub fn pin_chat(&mut self, chat_id: ChatId, now: TimestampMillis) {
        if !self.pinned_chats.value.contains(&chat_id) {
            self.pinned_chats.timestamp = now;
            self.pinned_chats.value.insert(0, chat_id);
        }
    }

    pub fn unpin_chat(&mut self, chat_id: &ChatId, now: TimestampMillis) {
        if self.pinned_chats.value.contains(chat_id) {
            self.pinned_chats.timestamp = now;
            self.pinned_chats.value.retain(|pinned_chat_id| pinned_chat_id != chat_id);
        }
    }

    pub fn ledger_canister_id(&self, token: &Cryptocurrency) -> CanisterId {
        self.ledger_canister_ids
            .get(token)
            .copied()
            .unwrap_or_else(|| panic!("Unable to find ledger canister for token '{token:?}'"))
    }

    pub fn is_diamond_member(&self, now: TimestampMillis) -> bool {
        self.diamond_membership_expires_at.map_or(false, |ts| now < ts)
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub direct_chats: u32,
    pub group_chats: u32,
    pub groups_created: u32,
    pub blocked_users: u32,
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub polls: u64,
    pub poll_votes: u64,
    pub cycles_messages: u64,
    pub icp_messages: u64,
    pub sns1_messages: u64,
    pub ckbtc_messages: u64,
    pub chat_messages: u64,
    pub deleted_messages: u64,
    pub giphy_messages: u64,
    pub replies: u64,
    pub edits: u64,
    pub reactions: u64,
    pub created: TimestampMillis,
    pub last_active: TimestampMillis,
    pub canister_ids: CanisterIds,
}

fn run_regular_jobs() {
    mutate_state(|state| state.regular_jobs.run(state.env.deref(), &mut state.data));
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub local_user_index: CanisterId,
    pub notifications: CanisterId,
    pub icp_ledger: CanisterId,
}
