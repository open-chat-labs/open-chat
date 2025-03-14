use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::ChannelId;

#[ts_export(community, toggle_mute_notifications)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub mute: bool,
}

#[ts_export(community, toggle_mute_notifications)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    UserNotInChannel,
    UserLapsed,
    Error(OCError),
}
