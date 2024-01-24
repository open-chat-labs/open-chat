use crate::model::communities::Communities;
use crate::model::community::Community;
use crate::model::direct_chats::DirectChats;
use crate::model::group_chat::GroupChat;
use crate::model::group_chats::GroupChats;
use crate::model::hot_group_exclusions::HotGroupExclusions;
use crate::model::p2p_swaps::P2PSwaps;
use crate::model::token_swaps::TokenSwaps;
use crate::timer_job_types::{RemoveExpiredEventsJob, TimerJob};
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use fire_and_forget_handler::FireAndForgetHandler;
use model::contacts::Contacts;
use model::favourite_chats::FavouriteChats;
use notifications_canister::c2c_push_notification;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::cell::RefCell;
use std::collections::HashSet;
use std::ops::Deref;
use types::{
    BuildVersion, CanisterId, Chat, ChatId, ChatMetrics, CommunityId, Cryptocurrency, Cycles, Document, Notification,
    TimestampMillis, Timestamped, UserId,
};
use user_canister::{NamedAccount, UserCanisterEvent};
use utils::canister_event_sync_queue::CanisterEventSyncQueue;
use utils::env::Environment;
use utils::regular_jobs::RegularJobs;

mod crypto;
mod governance_clients;
mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod openchat_bot;
mod queries;
mod regular_jobs;
mod timer_job_types;
mod token_swaps;
mod updates;

pub const BASIC_GROUP_CREATION_LIMIT: u32 = 5;
pub const PREMIUM_GROUP_CREATION_LIMIT: u32 = 40;
pub const COMMUNITY_CREATION_LIMIT: u32 = 10;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
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

    pub fn is_caller_escrow_canister(&self) -> bool {
        self.env.caller() == self.data.escrow_canister_id
    }

    pub fn is_caller_known_group_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.group_chats.exists(&caller.into())
    }

    pub fn is_caller_known_community_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.communities.exists(&caller.into())
    }

    pub fn push_notification(&mut self, recipient: UserId, notification: Notification) {
        let args = c2c_push_notification::Args {
            recipients: vec![recipient],
            authorizer: Some(self.data.local_user_index_canister_id),
            notification_bytes: ByteBuf::from(candid::encode_one(notification).unwrap()),
        };
        ic_cdk::spawn(push_notification_inner(self.data.notifications_canister_id, args));

        async fn push_notification_inner(canister_id: CanisterId, args: c2c_push_notification::Args) {
            let _ = notifications_canister_c2c_client::c2c_push_notification(canister_id, &args).await;
        }
    }

    pub fn run_event_expiry_job(&mut self) {
        let now = self.env.now();
        let mut next_event_expiry = None;
        for chat in self.data.direct_chats.iter_mut() {
            chat.events.remove_expired_events(now);
            if let Some(expiry) = chat.events.next_event_expiry() {
                if next_event_expiry.map_or(true, |current| expiry < current) {
                    next_event_expiry = Some(expiry);
                }
            }
        }

        self.data.next_event_expiry = next_event_expiry;
        if let Some(expiry) = self.data.next_event_expiry {
            self.data
                .timer_jobs
                .enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
    }

    pub fn push_user_canister_event(&mut self, canister_id: CanisterId, event: UserCanisterEvent) {
        self.data.user_canister_events_queue.push(canister_id, event);
        jobs::push_user_canister_events::try_run_now_for_canister(self, canister_id);
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
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
                proposals_bot: self.data.proposals_bot_canister_id,
                escrow: self.data.escrow_canister_id,
                icp_ledger: Cryptocurrency::InternetComputer.ledger_canister_id().unwrap(),
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub owner: Principal,
    pub direct_chats: DirectChats,
    pub group_chats: GroupChats,
    pub communities: Communities,
    pub favourite_chats: FavouriteChats,
    pub blocked_users: Timestamped<HashSet<UserId>>,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub avatar: Timestamped<Option<Document>>,
    pub test_mode: bool,
    pub is_platform_moderator: bool,
    pub hot_group_exclusions: HotGroupExclusions,
    pub username: Timestamped<String>,
    pub display_name: Timestamped<Option<String>>,
    pub bio: Timestamped<String>,
    pub storage_limit: u64,
    pub phone_is_verified: bool,
    pub user_created: TimestampMillis,
    pub suspended: Timestamped<bool>,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub contacts: Contacts,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub saved_crypto_accounts: Vec<NamedAccount>,
    pub next_event_expiry: Option<TimestampMillis>,
    pub token_swaps: TokenSwaps,
    pub p2p_swaps: P2PSwaps,
    pub user_canister_events_queue: CanisterEventSyncQueue<UserCanisterEvent>,
    pub rng_seed: [u8; 32],
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        owner: Principal,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        proposals_bot_canister_id: CanisterId,
        escrow_canister_id: CanisterId,
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
            proposals_bot_canister_id,
            escrow_canister_id,
            avatar: Timestamped::default(),
            test_mode,
            is_platform_moderator: false,
            hot_group_exclusions: HotGroupExclusions::default(),
            username: Timestamped::new(username, now),
            display_name: Timestamped::default(),
            bio: Timestamped::new("".to_string(), now),
            storage_limit: 0,
            phone_is_verified: false,
            user_created: now,
            suspended: Timestamped::default(),
            timer_jobs: TimerJobs::default(),
            contacts: Contacts::default(),
            diamond_membership_expires_at: None,
            fire_and_forget_handler: FireAndForgetHandler::default(),
            saved_crypto_accounts: Vec::new(),
            next_event_expiry: None,
            token_swaps: TokenSwaps::default(),
            p2p_swaps: P2PSwaps::default(),
            user_canister_events_queue: CanisterEventSyncQueue::default(),
            rng_seed: [0; 32],
        }
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

    pub fn is_diamond_member(&self, now: TimestampMillis) -> bool {
        self.diamond_membership_expires_at.map_or(false, |ts| now < ts)
    }

    pub fn remove_group(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<GroupChat> {
        self.favourite_chats.remove(&Chat::Group(chat_id), now);
        self.hot_group_exclusions.add(chat_id, None, now);
        self.group_chats.remove(chat_id, now)
    }

    pub fn remove_community(&mut self, community_id: CommunityId, now: TimestampMillis) -> Option<Community> {
        let community = self.communities.remove(community_id, now)?;
        for channel_id in community.channels.keys() {
            self.favourite_chats.remove(&Chat::Channel(community_id, *channel_id), now);
        }
        Some(community)
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
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
    pub proposals_bot: CanisterId,
    pub escrow: CanisterId,
    pub icp_ledger: CanisterId,
}
