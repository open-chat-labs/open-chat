use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, CommunityId, CommunityPermissions, Rules};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub rules: Rules,
    pub permissions: Option<CommunityPermissions>,
    pub primary_language: Option<String>,
    pub history_visible_to_new_joiners: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    AlreadyImportingToAnotherCommunity,
    NotAuthorized,
    UserSuspended,
    ChatFrozen,
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
}
