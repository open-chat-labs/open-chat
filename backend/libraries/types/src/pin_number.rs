use crate::TimestampMillis;
use candid::CandidType;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone, Debug)]
pub struct PinNumberSettings {
    pub length: u8,
    pub attempts_blocked_until: Option<TimestampMillis>,
}
