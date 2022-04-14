use crate::model::alerts::Alerts;
use crate::model::direct_chats::DirectChats;
use crate::model::failed_messages_pending_retry::FailedMessagesPendingRetry;
use crate::model::group_chats::GroupChats;
use crate::model::recommended_group_exclusions::RecommendedGroupExclusions;
use crate::model::transactions::Transactions;
use crate::model::user_cycles_balance::UserCyclesBalance;
use crate::model::user_preferences::UserPreferences;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use canister_state_macros::canister_state;
use ic_ledger_types::AccountIdentifier;
use ledger_utils::default_ledger_account;
use notifications_canister::c2c_push_notification;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{Avatar, CanisterId, Cycles, Notification, TimestampMillis, Timestamped, UserId, Version};
use utils::env::Environment;
use utils::memory;
use utils::rand::get_random_item;
use utils::regular_jobs::RegularJobs;

mod guards;
mod lifecycle;
mod model;
mod queries;
mod regular_jobs;
mod updates;

thread_local! {
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
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

    pub fn is_caller_callback_canister(&self) -> bool {
        self.env.caller() == self.data.callback_canister_id
    }

    pub fn push_notification(&mut self, recipients: Vec<UserId>, notification: Notification) {
        let random = self.env.random_u32() as usize;

        if let Some(canister_id) = get_random_item(&self.data.notifications_canister_ids, random) {
            let args = c2c_push_notification::Args {
                recipients,
                notification,
            };
            ic_cdk::spawn(push_notification_inner(*canister_id, args));
        }

        async fn push_notification_inner(canister_id: CanisterId, args: notifications_canister::c2c_push_notification::Args) {
            let _ = notifications_canister_c2c_client::c2c_push_notification(canister_id, &args).await;
        }
    }

    pub fn metrics(&self) -> Metrics {
        let chat_metrics = self.data.direct_chats.metrics();
        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            direct_chats: self.data.direct_chats.len() as u32,
            group_chats: self.data.group_chats.len() as u32,
            groups_created: self.data.group_chats.groups_created(),
            blocked_users: self.data.blocked_users.len() as u32,
            events: chat_metrics.total_events,
            text_messages: chat_metrics.text_messages,
            image_messages: chat_metrics.image_messages,
            video_messages: chat_metrics.video_messages,
            audio_messages: chat_metrics.audio_messages,
            file_messages: chat_metrics.file_messages,
            polls: chat_metrics.polls,
            poll_votes: chat_metrics.poll_votes,
            cycles_messages: chat_metrics.cycles_messages,
            icp_messages: chat_metrics.icp_messages,
            deleted_messages: chat_metrics.deleted_messages,
            giphy_messages: chat_metrics.giphy_messages,
            replies: chat_metrics.replies,
            edits: chat_metrics.edits,
            reactions: chat_metrics.reactions,
            total_events: chat_metrics.total_events,
            last_active: chat_metrics.last_active,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub owner: Principal,
    pub direct_chats: DirectChats,
    pub group_chats: GroupChats,
    pub blocked_users: HashSet<UserId>,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub callback_canister_id: CanisterId,
    pub avatar: Timestamped<Option<Avatar>>,
    pub user_cycles_balance: UserCyclesBalance,
    pub transactions: Transactions,
    pub test_mode: bool,
    pub user_preferences: UserPreferences,
    pub alerts: Alerts,
    pub failed_messages_pending_retry: FailedMessagesPendingRetry,
    pub is_super_admin: bool,
    pub recommended_group_exclusions: RecommendedGroupExclusions,
    pub bio: String,
}

impl Data {
    pub fn new(
        owner: Principal,
        user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notifications_canister_ids: Vec<CanisterId>,
        callback_canister_id: CanisterId,
        now: TimestampMillis,
        test_mode: bool,
    ) -> Data {
        Data {
            owner,
            direct_chats: DirectChats::default(),
            group_chats: GroupChats::default(),
            blocked_users: HashSet::new(),
            user_index_canister_id,
            group_index_canister_id,
            notifications_canister_ids,
            callback_canister_id,
            avatar: Timestamped::default(),
            user_cycles_balance: UserCyclesBalance::new(now),
            transactions: Transactions::default(),
            test_mode,
            user_preferences: UserPreferences::default(),
            alerts: Alerts::default(),
            failed_messages_pending_retry: FailedMessagesPendingRetry::default(),
            is_super_admin: false,
            recommended_group_exclusions: RecommendedGroupExclusions::default(),
            bio: "".to_string(),
        }
    }

    pub fn user_index_ledger_account(&self) -> AccountIdentifier {
        default_ledger_account(self.user_index_canister_id)
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub direct_chats: u32,
    pub group_chats: u32,
    pub groups_created: u32,
    pub blocked_users: u32,
    pub events: u64,
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub polls: u64,
    pub poll_votes: u64,
    pub cycles_messages: u64,
    pub icp_messages: u64,
    pub deleted_messages: u64,
    pub giphy_messages: u64,
    pub replies: u64,
    pub edits: u64,
    pub reactions: u64,
    pub total_events: u64,
    pub last_active: TimestampMillis,
}

fn run_regular_jobs() {
    mutate_state(|state| {
        let now = state.env.now();
        state.regular_jobs.run(now, &mut state.data);
    });
}
