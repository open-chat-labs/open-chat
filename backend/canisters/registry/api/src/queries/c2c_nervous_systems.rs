use crate::NervousSystemDetails;
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: Option<TimestampMillis>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub last_updated: TimestampMillis,
    pub nervous_systems: Vec<NervousSystemDetails>,
}
