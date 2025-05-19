use candid::Deserialize;
use serde::Serialize;
use std::collections::HashSet;
use ts_export::ts_export;
use types::{AutonomousBotScope, ChatEventType, CommunityEventType, UnitResult};
use user_canister::token_swap_status::CandidType;

#[ts_export(local_user_index, bot_subscribe_to_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub scope: AutonomousBotScope,
    pub community_events: HashSet<CommunityEventType>,
    pub chat_events: HashSet<ChatEventType>,
}

pub type Response = UnitResult;
