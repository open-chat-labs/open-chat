use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AuthToken, ChannelId};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub auth_token: AuthToken,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChannelNotFound,
    NotAuthenticated(String),
    InvalidRequest(String),
    NotAuthorized,
    Frozen,
    C2CError(i32, String),
}
