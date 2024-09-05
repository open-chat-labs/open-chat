use candid::CandidType;
use ts_export::ts_export;
use types::TimestampMillis;

#[ts_export(user, mark_achievements_seen)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub last_seen: TimestampMillis,
}

#[ts_export(user, mark_achievements_seen)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
}
