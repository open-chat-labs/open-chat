use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, MessageIndex, MiniAppStatus, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub status: MiniAppStatus,
}

pub type Response = UnitResult;
