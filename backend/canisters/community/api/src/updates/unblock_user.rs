use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(community, unblock_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[ts_export(community, unblock_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotInCommunity,
    CannotUnblockSelf,
    CommunityNotPublic,
    NotAuthorized,
    UserSuspended,
    CommunityFrozen,
    UserLapsed,
}
