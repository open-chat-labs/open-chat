use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, ChatId, CommunityId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
}
