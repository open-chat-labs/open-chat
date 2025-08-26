use candid::Deserialize;
use community_canister::c2c_bot_channel_details;
use group_canister::c2c_bot_group_details;
use oc_error_codes::OCError;
use serde::Serialize;
use ts_export::ts_export;
use types::{BotChatContext, ChatSummary};
use user_canister::{c2c_bot_chat_summary, token_swap_status::CandidType};

#[ts_export(local_user_index, bot_chat_summary)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
}

#[ts_export(local_user_index, bot_chat_summary)]
#[expect(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ChatSummary),
    Error(OCError),
}

impl From<c2c_bot_group_details::Response> for Response {
    fn from(r: c2c_bot_group_details::Response) -> Self {
        match r {
            c2c_bot_group_details::Response::Success(details) => Response::Success(ChatSummary::Group(details)),
            c2c_bot_group_details::Response::Error(error) => Response::Error(error),
        }
    }
}

impl From<c2c_bot_channel_details::Response> for Response {
    fn from(r: c2c_bot_channel_details::Response) -> Self {
        match r {
            c2c_bot_channel_details::Response::Success(details) => Response::Success(ChatSummary::Group(details)),
            c2c_bot_channel_details::Response::Error(error) => Response::Error(error),
        }
    }
}

impl From<c2c_bot_chat_summary::Response> for Response {
    fn from(r: c2c_bot_chat_summary::Response) -> Self {
        match r {
            c2c_bot_chat_summary::Response::Success(summary) => Response::Success(ChatSummary::Direct(summary)),
            c2c_bot_chat_summary::Response::Error(error) => Response::Error(error),
        }
    }
}
