use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AccessRules, CommunityId, CommunityPermissions};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub rules: AccessRules,
    pub permissions: Option<CommunityPermissions>,
    pub history_visible_to_new_joiners: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CommunityId),
    CallerNotInGroup,
    AlreadyImportingToAnotherCommunity,
    NotAuthorized,
    UserSuspended,
    ChatFrozen,
    InternalError(String),
}
