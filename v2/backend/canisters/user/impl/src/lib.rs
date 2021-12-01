use crate::model::alerts::Alerts;
use crate::model::direct_chats::DirectChats;
use crate::model::failed_messages_pending_retry::FailedMessagesPendingRetry;
use crate::model::group_chats::GroupChats;
use crate::model::transactions::Transactions;
use crate::model::user_cycles_balance::UserCyclesBalance;
use crate::model::user_preferences::UserPreferences;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{Avatar, CanisterId, Cycles, TimestampMillis, Timestamped, UserId, Version};
use utils::env::Environment;
use utils::memory;
use utils::regular_jobs::RegularJobs;

mod guards;
mod lifecycle;
mod model;
mod queries;
mod regular_jobs;
mod updates;

const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Serialize, Deserialize)]
enum StateVersion {
    V1,
}

thread_local! {
    static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
}

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
            cycles_messages: chat_metrics.cycles_messages,
            deleted_messages: chat_metrics.deleted_messages,
            total_edits: chat_metrics.total_edits,
            replies: chat_metrics.replies,
            total_reactions: chat_metrics.total_reactions,
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
    pub avatar: Option<Avatar>,
    pub user_cycles_balance: UserCyclesBalance,
    pub transactions: Transactions,
    pub test_mode: bool,
    pub user_preferences: UserPreferences,
    pub alerts: Alerts,
    pub failed_messages_pending_retry: FailedMessagesPendingRetry,
    pub is_super_admin: bool,
}

impl Data {
    pub fn new(
        owner: Principal,
        user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notifications_canister_ids: Vec<CanisterId>,
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
            avatar: None,
            user_cycles_balance: UserCyclesBalance::new(now),
            transactions: Transactions::default(),
            test_mode,
            user_preferences: UserPreferences::default(),
            alerts: Alerts::default(),
            failed_messages_pending_retry: FailedMessagesPendingRetry::default(),
            is_super_admin: false,
        }
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
    pub cycles_messages: u64,
    pub deleted_messages: u64,
    pub total_edits: u64,
    pub replies: u64,
    pub total_reactions: u64,
    pub last_active: TimestampMillis,
}

fn run_regular_jobs() {
    fn run_regular_jobs_impl(runtime_state: &mut RuntimeState) {
        let now = runtime_state.env.now();
        runtime_state.regular_jobs.run(now, &mut runtime_state.data);
    }

    RUNTIME_STATE.with(|state| run_regular_jobs_impl(state.borrow_mut().as_mut().unwrap()));
}
