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
    Group,
    Community,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GroupIndexEvent {
    GroupNameChanged(NameChanged),
    CommunityNameChanged(NameChanged),
    GroupVerifiedChanged(VerifiedChanged),
    CommunityVerifiedChanged(VerifiedChanged),
    NotifyOfUserDeleted(CanisterId, UserId),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NameChanged {
    pub canister_id: CanisterId,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VerifiedChanged {
    pub canister_id: CanisterId,
    pub verified: bool,
}
