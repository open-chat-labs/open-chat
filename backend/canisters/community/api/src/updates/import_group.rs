use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, ChatId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UserNotInCommunity,
    UserNotCommunityOwner,
    UserNotInGroup,
    UserNotGroupOwner,
    UserSuspended,
    GroupNotFound,
    GroupAlreadyBeingImported,
    GroupImportingToAnotherCommunity,
    GroupFrozen,
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub channel_id: ChannelId,
    pub total_bytes: u64,
}
