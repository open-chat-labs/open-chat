use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_id: CanisterId,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Response {
    // A MultiUser canister, which holds many users, each identified by an id carrying its index
    MultiUserCanister,
    Neither,
}
