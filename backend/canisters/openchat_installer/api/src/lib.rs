use candid::{CandidType, Deserialize};
use serde::Serialize;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
#[allow(unused_imports)]
pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum CanisterType {
    UserIndex,
}
