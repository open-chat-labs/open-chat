use crate::model::activity_notification_state::ActivityNotificationState;
use crate::model::participants::Participants;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use chat_events::GroupChatEvents;
use serde::Deserialize;
use std::cell::RefCell;
use types::{Avatar, CanisterId, ChatId, Milliseconds, TimestampMillis, UserId, Version};
use utils::blob_storage::BlobStorage;
use utils::env::Environment;

mod lifecycle;
mod model;
mod queries;
mod updates;

const MAX_STORAGE: u64 = 2 * 1024 * 1024 * 1024; // 2GB
const LOW_CYCLES_BALANCE_THRESHOLD: u64 = 100_000_000_000; // 0.1T
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
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_participant(&self) -> bool {
        self.data.participants.get(self.env.caller()).is_some()
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
        }
    }
}
