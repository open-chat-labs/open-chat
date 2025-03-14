use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, CommunityId, CommunityPermissions, Rules};

#[ts_export(group, convert_into_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub rules: Rules,
    pub permissions: Option<CommunityPermissions>,
    pub primary_language: Option<String>,
    pub history_visible_to_new_joiners: bool,
}

#[ts_export(group, convert_into_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    AlreadyImportingToAnotherCommunity,
    NotAuthorized,
    UserSuspended,
    UserLapsed,
    ChatFrozen,
    InternalError(String),
    Error(u16, Option<String>),
}

#[ts_export(group, convert_into_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
}
