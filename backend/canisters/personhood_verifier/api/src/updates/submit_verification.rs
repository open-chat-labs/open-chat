use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(personhood_verifier, submit_verification)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub session_id: u128,
}

#[ts_export(personhood_verifier, submit_verification)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Accepted,
    SessionNotFound,
    SessionExpired,
    IncompleteChallenge { missing_steps: Vec<u32> },
}
