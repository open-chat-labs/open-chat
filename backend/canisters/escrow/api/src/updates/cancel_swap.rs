use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SwapAlreadyAccepted,
    SwapExpired,
    SwapNotFound,
    NotAuthorized,
}
