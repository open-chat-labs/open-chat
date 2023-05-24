use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{ChannelId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub caller: UserId,
    pub users: Vec<(UserId, Principal)>,
    pub channel: Option<ChannelId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UserNotInCommunity,
    NotAuthorized,
    CommunityFrozen,
    TooManyInvites(u32),
    UserSuspended,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub invited_users: Vec<UserId>,
    pub community_name: String,
}
