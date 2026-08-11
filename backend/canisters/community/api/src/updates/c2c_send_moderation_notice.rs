use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, UnitResult};

// A plain-text OC-bot notice posted into the internal moderation channel by the user_index:
// for alarms which have no reported message to anchor a report card to
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub text: String,
}

pub type Response = UnitResult;
