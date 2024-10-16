use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::TimestampMillis;

#[ts_export(user_index, external_achievements)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[ts_export(user_index, external_achievements)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[ts_export(user_index, external_achievements)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub last_updated: TimestampMillis,
    pub added_or_updated: Vec<ExternalAchievement>,
    // TODO: Remove after FE updated to use added_or_updated
    pub achievements_added: Vec<ExternalAchievement>,
    // TODO: Remove after FE updated to use added_or_updated
    pub achievements_removed: Vec<ExternalAchievement>,
}

#[ts_export(user_index, external_achievements)]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct ExternalAchievement {
    pub id: u32,
    pub name: String,
    pub url: String,
    pub chit_reward: u32,
    pub expires: TimestampMillis,
    pub budget_exhausted: bool,
}
