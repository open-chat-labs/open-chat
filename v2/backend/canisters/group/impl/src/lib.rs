use crate::model::activity_notification_state::ActivityNotificationState;
use crate::model::events::Events;
use crate::model::participants::Participants;
use candid::Principal;
use std::cell::RefCell;
use types::{CanisterId, Milliseconds, TimestampMillis, UserId, Version};
use utils::blob_storage::BlobStorage;
use utils::env::Environment;

mod lifecycle;
mod model;
mod queries;
mod updates;

const MAX_STORAGE: u64 = 2 * 1024 * 1024 * 1024; // 2GB

thread_local! {
    pub static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
}

pub struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_participant(&self) -> bool {
        self.data.participants.get_by_principal(&self.env.caller()).is_some()
    }
}

pub struct Data {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub history_visible_to_new_joiners: bool,
    pub participants: Participants,
    pub events: Events,
    pub date_created: TimestampMillis,
    pub mark_active_duration: Milliseconds,
    pub group_index_canister_id: CanisterId,
    pub notification_canister_ids: Vec<CanisterId>,
    pub wasm_version: Version,
    pub activity_notification_state: ActivityNotificationState,
    pub blob_storage: BlobStorage,
}

#[allow(clippy::too_many_arguments)]
impl Data {
    pub fn new(
        is_public: bool,
        name: String,
        description: String,
        history_visible_to_new_joiners: bool,
        creator_principal: Principal,
        creator_user_id: UserId,
        now: TimestampMillis,
        mark_active_duration: Milliseconds,
        group_index_canister_id: CanisterId,
        wasm_version: Version,
    ) -> Data {
        let participants = Participants::new(creator_principal, creator_user_id, now);
        let events = Events::new(name.clone(), description.clone(), creator_user_id, now);

        Data {
            is_public,
            name,
            description,
            history_visible_to_new_joiners,
            participants,
            events,
            date_created: now,
            mark_active_duration,
            group_index_canister_id,
            notification_canister_ids: Vec::new(),
            wasm_version,
            activity_notification_state: ActivityNotificationState::new(now),
            blob_storage: BlobStorage::new(MAX_STORAGE),
        }
    }
}
