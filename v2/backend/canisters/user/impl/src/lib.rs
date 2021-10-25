use crate::model::direct_chats::DirectChats;
use crate::model::group_chats::GroupChats;
use crate::model::transactions::Transactions;
use crate::model::user_cycles_balance::UserCyclesBalance;
use crate::model::user_preferences::UserPreferences;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{Avatar, CanisterId, Cycles, TimestampMillis, UserId, Version};
use utils::blob_storage::BlobStorage;
use utils::env::Environment;
use utils::memory;
use utils::regular_jobs::RegularJobs;

mod lifecycle;
mod model;
mod queries;
mod regular_jobs;
mod updates;

const MAX_STORAGE: u64 = 2 * 1024 * 1024 * 1024; // 2GB
const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Deserialize)]
enum StateVersion {
    V1,
}

thread_local! {
    static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
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

    pub fn trap_if_caller_not_owner(&self) {
        if !self.is_caller_owner() {
            ic_cdk::trap("Not authorized");
        }
    }

    pub fn metrics(&self) -> Metrics {
        let blob_metrics = self.data.blob_storage.metrics();
        let chat_metrics = self.data.direct_chats.metrics();
        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: self.data.wasm_version,
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
            image_bytes: blob_metrics.image_bytes,
            video_bytes: blob_metrics.video_bytes,
            audio_bytes: blob_metrics.audio_bytes,
            total_blobs: blob_metrics.blob_count,
            total_blob_bytes: blob_metrics.total_bytes,
        }
    }
}

#[derive(CandidType, Deserialize)]
struct Data {
    pub owner: Principal,
    pub direct_chats: DirectChats,
    pub group_chats: GroupChats,
    pub blocked_users: HashSet<UserId>,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notification_canister_ids: Vec<CanisterId>,
    pub wasm_version: Version,
    pub blob_storage: BlobStorage,
    pub avatar: Option<Avatar>,
    pub user_cycles_balance: UserCyclesBalance,
    pub transactions: Transactions,
    pub test_mode: bool,
    pub user_preferences: UserPreferences,
}

impl Data {
    pub fn new(
        owner: Principal,
        user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notification_canister_ids: Vec<CanisterId>,
        wasm_version: Version,
        test_mode: bool,
    ) -> Data {
        Data {
            owner,
            direct_chats: DirectChats::default(),
            group_chats: GroupChats::default(),
            blocked_users: HashSet::new(),
            user_index_canister_id,
            group_index_canister_id,
            notification_canister_ids,
            wasm_version,
            blob_storage: BlobStorage::new(MAX_STORAGE),
            avatar: None,
            user_cycles_balance: UserCyclesBalance::default(),
            transactions: Transactions::default(),
            test_mode,
            user_preferences: UserPreferences::default(),
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
    pub total_blobs: u32,
    pub total_blob_bytes: u64,
    pub image_bytes: u64,
    pub video_bytes: u64,
    pub audio_bytes: u64,
}

fn run_regular_jobs() {
    fn run_regular_jobs_impl(runtime_state: &mut RuntimeState) {
        let now = runtime_state.env.now();
        runtime_state.regular_jobs.run(now, &mut runtime_state.data);
    }

    RUNTIME_STATE.with(|state| run_regular_jobs_impl(state.borrow_mut().as_mut().unwrap()));
}
