use candid::{CandidType, Principal};
use serde::Serialize;

#[derive(CandidType, Serialize)]
pub struct Args {
    pub email: String,
}

pub type Response = Principal;
