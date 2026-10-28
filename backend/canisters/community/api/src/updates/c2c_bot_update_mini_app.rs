use serde::{Deserialize, Serialize};
use types::{BotInitiator, ChannelId, MessageId, MessageIndex, MiniAppUpdate, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: ChannelId,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub update: MiniAppUpdate,
}

pub type Response = UnitResult;
