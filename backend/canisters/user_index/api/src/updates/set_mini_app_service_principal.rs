use candid::{CandidType, Principal};
use human_readable::HumanReadable;
use serde::{Deserialize, Serialize};
use types::SuccessOnly;

#[derive(CandidType, Serialize, Deserialize, HumanReadable, Clone, Debug)]
pub struct Args {
    pub principal: Principal,
}

pub type Response = SuccessOnly;
