use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, CommunityId, UnitResult};

#[ts_export(local_user_index, bot_delete_channel_v2)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
}

pub type Response = UnitResult;
