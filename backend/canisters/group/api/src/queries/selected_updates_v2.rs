use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{SelectedGroupUpdates, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SelectedGroupUpdates),
    SuccessNoUpdates(TimestampMillis),
    CallerNotInGroup,
}
