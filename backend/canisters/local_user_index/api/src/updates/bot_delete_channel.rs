use candid::CandidType;
use ts_export::ts_export;
use serde::{Deserialize, Serialize};
use types::{AuthToken, ChannelId};

#[ts_export(local_user_index, bot_delete_channel)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub auth_token: AuthToken,
}

#[ts_export(local_user_index, bot_delete_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChannelNotFound,
    FailedAuthentication(String),
    InvalidRequest(String),
    NotAuthorized,
    Frozen,
    C2CError(i32, String),
}
