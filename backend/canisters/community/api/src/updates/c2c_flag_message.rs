use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, MessageIndex, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub flags: u32,
    // Delete the message as part of the same update. A moderation takedown must set the
    // read-gate flag and delete the message atomically: sent as two fire-and-forget messages
    // they carry no ordering guarantee, and a message deleted while its flag is still in
    // flight is readable by its sender through `deleted_message` and can be undeleted.
    #[serde(default)]
    pub delete: bool,
}

pub type Response = UnitResult;
