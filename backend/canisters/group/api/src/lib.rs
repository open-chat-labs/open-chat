use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
use oc_error_codes::OCError;
pub use queries::*;
pub use updates::*;

#[ts_export(group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum EventsResponse {
    Success(types::EventsResponse),
    CallerNotInGroup,
    ThreadMessageNotFound,
    UserSuspended,
    UserLapsed,
    ReplicaNotUpToDateV2(types::TimestampMillis),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum LocalGroupIndexEvent {
    NameChanged(NameChanged),
    VerifiedChanged(VerifiedChanged),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NameChanged {
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VerifiedChanged {
    pub verified: bool,
}
