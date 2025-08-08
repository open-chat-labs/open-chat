use candid::CandidType;
use human_readable::HumanReadable;
use serde::{Deserialize, Serialize};
use types::SuccessOnly;

#[derive(CandidType, Serialize, Deserialize, HumanReadable, Clone, Debug)]
pub struct Args {
    pub value: u32,
}

pub type Response = SuccessOnly;
