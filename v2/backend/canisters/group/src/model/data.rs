use crate::model::activity_notification_state::ActivityNotificationState;
use crate::model::messages::Messages;
use crate::model::participants::Participants;
use candid::Principal;
use shared::time::TimestampMillis;
use shared::types::{CanisterId, UserId, Version};

pub struct Data {
    pub is_public: bool,
    pub name: String,
    pub description: Option<String>,
    pub participants: Participants,
    pub messages: Messages,
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

        Data {
            is_public,
            name,
            description: None,
            participants,
            messages: Messages::default(),
            date_created: now,
            group_index_canister_id,
            notification_canister_ids: Vec::new(),
            wasm_version,
            activity_notification_state: ActivityNotificationState::new(now),
        }
    }
}
