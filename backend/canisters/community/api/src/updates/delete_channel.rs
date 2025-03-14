use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::ChannelId;

#[ts_export(community, delete_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
}

#[ts_export(community, delete_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserSuspended,
    UserNotInCommunity,
    ChannelNotFound,
    UserNotInChannel,
    NotAuthorized,
    UserLapsed,
    Error(OCError),
}
