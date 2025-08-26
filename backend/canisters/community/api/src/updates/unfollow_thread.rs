use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageIndex, UnitResult};

#[ts_export(community, unfollow_thread)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: MessageIndex,
}

pub type Response = UnitResult;
