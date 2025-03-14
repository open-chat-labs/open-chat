use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, ChatId};

#[ts_export(community, import_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
}

#[ts_export(community, import_group)]
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
    UserLapsed,
    Error(OCError),
}

#[ts_export(community, import_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub channel_id: ChannelId,
    pub total_bytes: u64,
}
