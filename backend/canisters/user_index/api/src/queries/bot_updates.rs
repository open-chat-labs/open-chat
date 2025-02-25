use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AutonomousConfig, BotCommandDefinition, BotRegistrationState, TimestampMillis, UserId};

#[ts_export(user_index, bot_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub updated_since: TimestampMillis,
}

#[ts_export(user_index, bot_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[ts_export(user_index, bot_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub added_or_updated: Vec<BotDetails>,
    pub removed: Vec<UserId>,
    pub timestamp: TimestampMillis,
}

#[ts_export(user_index, bot_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct BotDetails {
    pub id: UserId,
    pub owner: UserId,
    pub name: String,
    pub avatar_id: Option<u128>,
    pub endpoint: String,
    pub description: String,
    pub commands: Vec<BotCommandDefinition>,
    pub autonomous_config: Option<AutonomousConfig>,
    pub last_updated: TimestampMillis,
    pub registration_state: BotRegistrationState,
}
