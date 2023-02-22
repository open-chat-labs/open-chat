use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Cycles, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub max_top_up_amount: Option<Cycles>,
    pub min_interval: Option<Milliseconds>,
    pub min_cycles_balance: Option<Cycles>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
