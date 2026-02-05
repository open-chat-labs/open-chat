use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{TimestampMillis, UnitResult};

#[ts_export(group, delete_history)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub before: TimestampMillis,
}

pub type Response = UnitResult;
