use candid::{CandidType, Deserialize};
use serde::Serialize;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub enum ChildCanisterType {
    LocalGroupIndex,
    Group,
    Community,
}
