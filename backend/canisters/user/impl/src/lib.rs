use crate::model::cached_group_summaries::CachedGroupSummaries;
use crate::model::communities::Communities;
use crate::model::direct_chats::DirectChats;
use crate::model::group_chats::GroupChats;
use crate::model::hot_group_exclusions::HotGroupExclusions;
use crate::timer_job_types::TimerJob;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use fire_and_forget_handler::FireAndForgetHandler;
use ic_ledger_types::AccountIdentifier;
use ledger_utils::default_ledger_account;
use model::contacts::Contacts;
use model::favourite_chats::FavouriteChats;
use notifications_canister::c2c_push_notification;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use std::ops::Deref;
use types::{
    CanisterId, Chat, ChatId, ChatMetrics, Cryptocurrency, Cycles, Document, Notification, TimestampMillis, Timestamped,
    UserId, Version,
};
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
pub const COMMUNITY_CREATION_LIMIT: u32 = 10;

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
            created: self.data.user_created,
            direct_chat_metrics: self.data.direct_chats.metrics().hydrate(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                notifications: self.data.notifications_canister_id,
                icp_ledger: Cryptocurrency::InternetComputer.ledger_canister_id(),
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub owner: Principal,
    pub direct_chats: DirectChats,
    pub group_chats: GroupChats,
    #[serde(default)]
    pub communities: Communities,
    #[serde(default)]
    pub favourite_chats: FavouriteChats,
    pub blocked_users: Timestamped<HashSet<UserId>>,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub avatar: Timestamped<Option<Document>>,
    pub test_mode: bool,
    pub is_platform_moderator: bool,
    pub hot_group_exclusions: HotGroupExclusions,
    pub username: String,
    pub bio: String,
    pub cached_group_summaries: Option<CachedGroupSummaries>,
    pub storage_limit: u64,
    pub phone_is_verified: bool,
    pub user_created: TimestampMillis,
    // Remove pinned_chats after the next upgrade
    pub pinned_chats: Timestamped<Vec<ChatId>>,
    pub pending_user_principal_migration: Option<Principal>,
    pub suspended: Timestamped<bool>,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub contacts: Contacts,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    #[serde(default)]
    pub fire_and_forget_handler: FireAndForgetHandler,
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
            communities: Communities::default(),
            favourite_chats: FavouriteChats::default(),
            blocked_users: Timestamped::default(),
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            notifications_canister_id,
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
            fire_and_forget_handler: FireAndForgetHandler::default(),
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

    // TODO: Legacy - delete me once communities enabled
    pub fn pin_chat(&mut self, chat_id: ChatId, now: TimestampMillis) {
        let chat = if self.direct_chats.get(&chat_id).is_some() { Chat::Direct(chat_id) } else { Chat::Group(chat_id) };

        self.favourite_chats.add(chat, now);
    }

    // TODO: Legacy - delete me once communities enabled
    pub fn unpin_chat(&mut self, chat_id: ChatId, now: TimestampMillis) {
        let chat = if self.direct_chats.get(&chat_id).is_some() { Chat::Direct(chat_id) } else { Chat::Group(chat_id) };

        self.favourite_chats.remove(chat, now);
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
    pub created: TimestampMillis,
    pub direct_chat_metrics: ChatMetrics,
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
