use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // The number of canisters queued to be refunded
    pub canisters: u32,
    // Those which couldn't be matched to a LocalUserIndex via the IC registry's routing table,
    // so were sent to all of them
    pub canisters_not_routed: u32,
}
