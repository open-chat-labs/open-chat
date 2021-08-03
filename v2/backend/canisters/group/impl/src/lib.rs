use crate::model::activity_notification_state::ActivityNotificationState;
use crate::model::events::{EventDataInternal, Events};
use crate::model::participants::Participants;
use candid::Principal;
use group_canister::common::events::GroupChatCreated;
use shared::env::Environment;
use shared::time::TimestampMillis;
use shared::types::{CanisterId, UserId, Version};
use std::cell::RefCell;

mod lifecycle;
mod model;
mod queries;
mod updates;

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
    pub description: Option<String>,
    pub participants: Participants,
    pub events: Events,
    pub date_created: TimestampMillis,
    pub group_index_canister_id: CanisterId,
    pub notification_canister_ids: Vec<CanisterId>,
    pub wasm_version: Version,
    pub activity_notification_state: ActivityNotificationState,
}

impl Data {
    pub fn new(
        is_public: bool,
        name: String,
        creator_principal: Principal,
        creator_user_id: UserId,
        now: TimestampMillis,
        group_index_canister_id: CanisterId,
        wasm_version: Version,
    ) -> Data {
        let participants = Participants::new(creator_principal, creator_user_id, now);
        let mut events = Events::default();
        events.push_event(
            EventDataInternal::GroupChatCreated(GroupChatCreated {
                name: name.clone(),
                description: None,
                created_by: creator_user_id,
            }),
            now,
        );

        Data {
            is_public,
            name,
            description: None,
            participants,
            events,
            date_created: now,
            group_index_canister_id,
            notification_canister_ids: Vec::new(),
            wasm_version,
            activity_notification_state: ActivityNotificationState::new(now),
        }
    }
}
