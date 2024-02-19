use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AccessTokenType, ChannelId, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub is_diamond: bool,
    pub channel_id: ChannelId,
    pub access_type: AccessTokenType,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Yes,
    No,
    ChannelNotFound,
}
