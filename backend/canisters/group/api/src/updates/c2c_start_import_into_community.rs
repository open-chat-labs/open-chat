use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub community_id: CommunityId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64),
    AlreadyImportingToAnotherCommunity,
    UserNotInGroup,
    UserNotGroupOwner,
    UserSuspended,
    ChatFrozen,
}
