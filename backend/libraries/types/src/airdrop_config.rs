use crate::{ChannelId, CommunityId};
use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AirdropConfig {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub community_name: String,
    pub channel_name: String,
}
