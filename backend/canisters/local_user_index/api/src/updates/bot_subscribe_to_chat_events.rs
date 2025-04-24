use candid::Deserialize;
use serde::Serialize;
use ts_export::ts_export;
use types::{ChannelId, ChatEventType, UnitResult};
use user_canister::token_swap_status::CandidType;

#[ts_export(local_user_index, bot_subscribe_to_chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub event_types: Vec<ChatEventType>,
    pub api_key: String,
}

pub type Response = UnitResult;
