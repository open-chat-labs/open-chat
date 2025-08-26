use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{SuccessOnly, TimestampMillis};

#[ts_export(user, mark_message_activity_feed_read)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub read_up_to: TimestampMillis,
}

pub type Response = SuccessOnly;
