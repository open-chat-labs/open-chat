use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, EmptySuccessOrError, MessageIndex};

#[ts_export(community, follow_thread)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: MessageIndex,
    pub new_achievement: bool,
}

pub type Response = EmptySuccessOrError;
