use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{UnitResult, UserId};

#[ts_export(user_index, set_discord_bot)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // None to clear it
    pub bot_id: Option<UserId>,
}

pub type Response = UnitResult;
