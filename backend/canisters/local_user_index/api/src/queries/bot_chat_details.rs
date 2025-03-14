use candid::Deserialize;
use community_canister::c2c_bot_channel_details;
use group_canister::c2c_bot_group_details;
use serde::Serialize;
use ts_export::ts_export;
use types::{AuthToken, ChannelId};
use user_canister::token_swap_status::CandidType;

#[ts_export(local_user_index, bot_chat_details)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub auth_token: AuthToken,
}

#[ts_export(local_user_index, bot_chat_details)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(types::ChatDetails),
    FailedAuthentication(String),
    DirectChatUnsupported,
    NotAuthorized,
    NotFound,
    InternalError(String),
    Error(u16, Option<String>),
}

impl From<c2c_bot_group_details::Response> for Response {
    fn from(r: c2c_bot_group_details::Response) -> Self {
        match r {
            c2c_bot_group_details::Response::Success(details) => Response::Success(details),
            c2c_bot_group_details::Response::NotAuthorized => Response::NotAuthorized,
            c2c_bot_group_details::Response::Error(code, message) => Response::Error(code, message),
        }
    }
}

impl From<c2c_bot_channel_details::Response> for Response {
    fn from(r: c2c_bot_channel_details::Response) -> Self {
        match r {
            c2c_bot_channel_details::Response::Success(details) => Response::Success(details),
            c2c_bot_channel_details::Response::NotAuthorized => Response::NotAuthorized,
            c2c_bot_channel_details::Response::Error(code, message) => Response::Error(code, message),
        }
    }
}
