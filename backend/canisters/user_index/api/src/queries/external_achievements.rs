use candid::CandidType;
use ts_export::ts_export;
use types::TimestampMillis;

#[ts_export(user_index, external_achievements)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[ts_export(user_index, external_achievements)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[ts_export(user_index, external_achievements)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub achievements_added: Vec<ExternalAchievement>,
    pub achievements_removed: Vec<ExternalAchievement>,
}

#[ts_export(user_index, external_achievements)]
#[derive(CandidType, Debug)]
pub struct ExternalAchievement {
    pub name: String,
    pub logo_id: u128,
    pub chit_reward: u32,
}
