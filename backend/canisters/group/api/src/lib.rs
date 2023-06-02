use candid::CandidType;
use serde::{Deserialize, Serialize};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum EventsResponse {
    Success(types::EventsResponse),
    CallerNotInGroup,
    ThreadMessageNotFound,
    ReplicaNotUpToDate(types::EventIndex),
}
