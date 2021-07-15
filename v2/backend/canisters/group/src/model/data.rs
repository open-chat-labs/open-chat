use crate::model::messages::Messages;
use crate::model::participants::Participants;
use shared::time::TimestampMillis;
use shared::types::CanisterId;

#[derive(Default)]
pub struct Data {
    pub is_public: bool,
    pub name: String,
    pub description: Option<String>,
    pub participants: Participants,
    pub messages: Messages,
    pub date_created: TimestampMillis,
    pub notification_canister_ids: Vec<CanisterId>,
}
