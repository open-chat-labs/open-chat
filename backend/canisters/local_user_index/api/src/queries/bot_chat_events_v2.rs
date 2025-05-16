use crate::chat_events::EventsSelectionCriteria;
use candid::Deserialize;
use serde::Serialize;
use ts_export::ts_export;
use types::BotChatContext;
use user_canister::token_swap_status::CandidType;

#[ts_export(local_user_index, bot_chat_events_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub events: EventsSelectionCriteria,
}

pub type Response = crate::bot_chat_events::Response;
