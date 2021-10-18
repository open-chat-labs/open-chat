use crate::model::activity_notification_state::ActivityNotificationState;
use crate::model::participants::Participants;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use chat_events::GroupChatEvents;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use types::{Avatar, CanisterId, ChatId, Cycles, Milliseconds, TimestampMillis, UserId, Version};
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

    pub fn is_caller_participant(&self) -> bool {
        self.data.participants.get(self.env.caller()).is_some()
    }

    pub fn metrics(&self) -> Metrics {
        let am = &self.data.accumulated_metrics;
        let last_active = self.data.events.latest().map_or(0, |e| e.timestamp);
        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: self.data.wasm_version,
            participants: self.data.participants.len() as u32,
            admins: am.admins,
            events: self.data.events.len() as u64,
            text_messages: am.text_messages,
            image_messages: am.image_messages,
            video_messages: am.video_messages,
            audio_messages: am.audio_messages,
            file_messages: am.file_messages,
            cycles_messages: am.cycles_messages,
            deleted_messages: am.deleted_messages,
            total_edits: am.total_edits,
            replies_messages: am.replies_messages,
            total_reactions: am.total_reactions,
            last_active,
            image_bytes: am.image_bytes,
            video_bytes: am.video_bytes,
            audio_bytes: am.audio_bytes,
            total_blobs: self.data.blob_storage.blob_count(),
            total_blob_bytes: self.data.blob_storage.total_bytes(),
        }
    }
}

#[derive(CandidType, Deserialize)]
struct Data {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub avatar: Option<Avatar>,
    pub history_visible_to_new_joiners: bool,
    pub participants: Participants,
    pub events: GroupChatEvents,
    pub date_created: TimestampMillis,
    pub mark_active_duration: Milliseconds,
    pub group_index_canister_id: CanisterId,
    pub notification_canister_ids: Vec<CanisterId>,
    pub wasm_version: Version,
    pub activity_notification_state: ActivityNotificationState,
    pub blob_storage: BlobStorage,
    pub test_mode: bool,
    pub accumulated_metrics: AccumulatedMetrics,
}

#[allow(clippy::too_many_arguments)]
impl Data {
    pub fn new(
        chat_id: ChatId,
        is_public: bool,
        name: String,
        description: String,
        avatar: Option<Avatar>,
        history_visible_to_new_joiners: bool,
        creator_principal: Principal,
        creator_user_id: UserId,
        now: TimestampMillis,
        mark_active_duration: Milliseconds,
        group_index_canister_id: CanisterId,
        notification_canister_ids: Vec<CanisterId>,
        wasm_version: Version,
        test_mode: bool,
    ) -> Data {
        let participants = Participants::new(creator_principal, creator_user_id, now);
        let events = GroupChatEvents::new(chat_id, name.clone(), description.clone(), creator_user_id, now);

        Data {
            is_public,
            name,
            description,
            avatar,
            history_visible_to_new_joiners,
            participants,
            events,
            date_created: now,
            mark_active_duration,
            group_index_canister_id,
            notification_canister_ids,
            wasm_version,
            activity_notification_state: ActivityNotificationState::new(now),
            blob_storage: BlobStorage::new(MAX_STORAGE),
            test_mode,
            accumulated_metrics: AccumulatedMetrics::new(),
        }
    }
}

#[derive(CandidType, Deserialize, Debug)]
pub struct AccumulatedMetrics {
    pub admins: u16,
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub cycles_messages: u64,
    pub deleted_messages: u64,
    pub total_edits: u64,
    pub replies_messages: u64,
    pub total_reactions: u64,
    pub image_bytes: u64,
    pub video_bytes: u64,
    pub audio_bytes: u64,
}

impl AccumulatedMetrics {
    pub fn new() -> AccumulatedMetrics {
        AccumulatedMetrics {
            admins: 1,
            text_messages: 0,
            image_messages: 0,
            video_messages: 0,
            audio_messages: 0,
            file_messages: 0,
            cycles_messages: 0,
            deleted_messages: 0,
            total_edits: 0,
            replies_messages: 0,
            total_reactions: 0,
            image_bytes: 0,
            video_bytes: 0,
            audio_bytes: 0,
        }
    }
}

impl Default for AccumulatedMetrics {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub participants: u32,
    pub admins: u16, // TODO: Should probably limit the number of admins
    pub events: u64,
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub cycles_messages: u64,
    pub deleted_messages: u64,
    pub total_edits: u64,
    pub replies_messages: u64,
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
