use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, MessageIndex, MiniAppUpdate, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub update: MiniAppUpdate,
}

pub type Response = UnitResult;
