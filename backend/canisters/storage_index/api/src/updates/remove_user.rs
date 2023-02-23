use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
