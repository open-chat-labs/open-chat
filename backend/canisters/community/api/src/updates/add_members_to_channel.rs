use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, GateCheckFailedReason, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub user_ids: Vec<UserId>,
    pub added_by_name: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(PartialSuccessResult),
    Failed(FailedResult),
    CommunityFrozen,
    UserSuspended,
    UserNotInCommunity,
    UserNotInChannel,
    ChannelNotFound,
    UserLimitReached(u32),
    NotAuthorized,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialSuccessResult {
    pub users_added: Vec<UserId>,
    pub users_already_in_channel: Vec<UserId>,
    pub users_limit_reached: Vec<UserId>,
    pub users_failed_gate_check: Vec<UserFailedGateCheck>,
    pub users_failed_with_error: Vec<UserFailedError>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FailedResult {
    pub users_already_in_channel: Vec<UserId>,
    pub users_limit_reached: Vec<UserId>,
    pub users_failed_gate_check: Vec<UserFailedGateCheck>,
    pub users_failed_with_error: Vec<UserFailedError>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserFailedGateCheck {
    pub user_id: UserId,
    pub reason: GateCheckFailedReason,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserFailedError {
    pub user_id: UserId,
    pub error: String,
}
