use crate::{ChannelId, ChatId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SourceGroup {
    pub group_id: ChatId,
    pub channel_id: ChannelId,
    pub total_bytes: u64,
}
