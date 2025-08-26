use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::SuccessOnly;

#[ts_export(user, cancel_message_reminder)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub reminder_id: u64,
}

pub type Response = SuccessOnly;
