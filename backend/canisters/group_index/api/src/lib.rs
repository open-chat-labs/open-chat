use candid::{CandidType, Deserialize};
use serde::Serialize;
use types::{CanisterId, UserId};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ChildCanisterType {
    LocalGroupIndex,
    Group,
    Community,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    NotifyOfUserDeleted(CanisterId, UserId),
}
