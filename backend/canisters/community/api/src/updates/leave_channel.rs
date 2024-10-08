use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::ChannelId;

#[ts_export(community, leave_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
}

#[ts_export(community, leave_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    UserNotInChannel,
    LastOwnerCannotLeave,
}
