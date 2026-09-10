use candid::CandidType;
use human_readable::HumanReadable;
use serde::{Deserialize, Serialize};
use types::{CanisterId, SuccessOnly};

#[derive(CandidType, Serialize, Deserialize, HumanReadable, Clone, Debug)]
pub struct Args {
    pub canister_id: CanisterId,
}

pub type Response = SuccessOnly;
