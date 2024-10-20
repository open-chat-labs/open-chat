use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
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
}
