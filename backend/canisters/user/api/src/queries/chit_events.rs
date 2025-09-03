use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChitEvent, TimestampMillis};

#[ts_export(user, chit_events)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub from: Option<TimestampMillis>,
    pub to: Option<TimestampMillis>,
    pub skip: Option<u32>,
    pub max: u32,
    pub ascending: bool,
}

#[ts_export(user, chit_events)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user, chit_events)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<ChitEvent>,
    pub total: u32,
}
