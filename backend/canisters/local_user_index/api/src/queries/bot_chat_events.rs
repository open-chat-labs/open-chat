use crate::chat_events::EventsSelectionCriteria;
use candid::Deserialize;
use serde::Serialize;
use ts_export::ts_export;
use types::{AuthToken, ChannelId};
use user_canister::token_swap_status::CandidType;

#[ts_export(local_user_index, bot_chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub events: EventsSelectionCriteria,
    pub auth_token: AuthToken,
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(types::EventsResponse),
    FailedAuthentication(String),
    NotAuthorized,
    NotFound,
    InternalError(String),
}
