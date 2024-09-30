use candid::CandidType;
use serde::{Deserialize, Serialize};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
use ts_export::ts_export;
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
}
