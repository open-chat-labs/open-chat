use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, CommunityId, UnitResult};

#[ts_export(user_index, set_internal_moderation_channel)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel: Option<InternalModerationChannel>,
}

#[ts_export(user_index, set_internal_moderation_channel)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InternalModerationChannel {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
}

pub type Response = UnitResult;
