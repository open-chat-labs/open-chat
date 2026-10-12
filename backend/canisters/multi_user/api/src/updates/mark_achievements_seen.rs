use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{SuccessOnly, TimestampMillis};

#[ts_export(user, mark_achievements_seen)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub last_seen: TimestampMillis,
}

pub type Response = SuccessOnly;
