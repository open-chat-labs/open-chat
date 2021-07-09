use crate::model::messages::Messages;
use crate::model::participants::Participants;
use shared::time::TimestampMillis;

#[derive(Default)]
pub struct Data {
    pub is_public: bool,
    pub subject: String,
    pub participants: Participants,
    pub messages: Messages,
    pub date_created: TimestampMillis,
}
