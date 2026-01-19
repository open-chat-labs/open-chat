use candid::CandidType;
use community_canister::c2c_bot_change_channel_role;
use group_canister::c2c_bot_change_role;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_export::ts_export;
use types::{BotChatContext, GroupRole, UserId};

#[ts_export(local_user_index, bot_change_role)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub user_ids: Vec<UserId>,
    pub new_role: GroupRole,
}

#[ts_export(local_user_index, bot_change_role)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(HashMap<UserId, OCError>),
    Error(OCError),
}

impl From<c2c_bot_change_role::Response> for Response {
    fn from(value: c2c_bot_change_role::Response) -> Self {
        match value {
            group_canister::change_role::Response::Success => Response::Success,
            group_canister::change_role::Response::PartialSuccess(hash_map) => Response::PartialSuccess(hash_map),
            group_canister::change_role::Response::Error(error) => Response::Error(error),
        }
    }
}

impl From<c2c_bot_change_channel_role::Response> for Response {
    fn from(value: c2c_bot_change_channel_role::Response) -> Self {
        match value {
            community_canister::change_channel_role::Response::Success => Response::Success,
            community_canister::change_channel_role::Response::PartialSuccess(hash_map) => Response::PartialSuccess(hash_map),
            community_canister::change_channel_role::Response::Error(error) => Response::Error(error),
        }
    }
}
