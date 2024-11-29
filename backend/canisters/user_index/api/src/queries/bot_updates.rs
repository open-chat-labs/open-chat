use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{SlashCommandSchema, TimestampMillis, UserId};

#[ts_export(user_index, bot_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updated_since: TimestampMillis,
}

#[ts_export(user_index, bot_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[ts_export(user_index, bot_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub added_or_updated: Vec<BotSchema>,
    pub deleted: Vec<UserId>,
    pub timestamp: TimestampMillis,
}

#[ts_export(user_index, bot_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct BotSchema {
    pub id: UserId,
    pub owner: UserId,
    pub name: String,
    pub avatar_id: Option<u128>,
    pub endpoint: String,
    pub description: String,
    pub commands: Vec<SlashCommandSchema>,
    pub last_updated: TimestampMillis,
}
