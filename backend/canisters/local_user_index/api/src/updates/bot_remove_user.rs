use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotLocationContext, UnitResult, UserId};

#[ts_export(local_user_index, bot_block_user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub location_context: BotLocationContext,
    pub user_id: UserId,
    pub block: bool,
}

pub type Response = UnitResult;
