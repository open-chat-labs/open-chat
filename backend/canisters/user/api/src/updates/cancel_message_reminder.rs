use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user, cancel_message_reminder)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub reminder_id: u64,
}

#[ts_export(user, cancel_message_reminder)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
