use candid::CandidType;
use human_readable::HumanReadable;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, HumanReadable, Clone, Debug)]
pub struct Args {
    pub value: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
