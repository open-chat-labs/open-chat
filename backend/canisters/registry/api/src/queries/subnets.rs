use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, Empty};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<Subnet>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Subnet {
    pub subnet_id: Principal,
    pub local_user_index: CanisterId,
    pub local_group_index: CanisterId,
    pub notifications_canister: CanisterId,
}
