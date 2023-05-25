use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, CommunityId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub user_ids: Vec<UserId>,
    pub channel: Option<ChannelId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityNotFound,
    UserNotInCommunity,
    NotAuthorized,
    CommunityFrozen,
    TooManyInvites(u32),
    UserSuspended,
    InternalError(String),
}
