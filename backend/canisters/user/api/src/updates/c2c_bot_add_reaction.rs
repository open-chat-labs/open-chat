use serde::{Deserialize, Serialize};
use types::{BotInitiator, MessageId, MessageIndex, Reaction, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub bot_name: String,
}

pub type Response = UnitResult;
