use candid::Deserialize;
use serde::Serialize;
use ts_export::ts_export;
use types::BotChatContext;
use user_canister::token_swap_status::CandidType;

#[ts_export(local_user_index, bot_chat_details_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
}

pub type Response = crate::bot_chat_details::Response;
