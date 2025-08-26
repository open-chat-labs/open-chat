use crate::{Milliseconds, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum SuspensionDuration {
    Duration(Milliseconds),
    Indefinitely,
}

impl From<SuspensionDuration> for Option<Milliseconds> {
    fn from(value: SuspensionDuration) -> Self {
        if let SuspensionDuration::Duration(duration) = value { Some(duration) } else { None }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuspensionDetails {
    pub reason: String,
    pub action: SuspensionAction,
    pub suspended_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum SuspensionAction {
    Unsuspend(TimestampMillis),
    Delete(TimestampMillis),
}
