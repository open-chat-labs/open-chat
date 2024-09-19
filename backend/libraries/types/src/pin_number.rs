use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PinNumberSettings {
    pub length: u8,
    pub attempts_blocked_until: Option<TimestampMillis>,
}
