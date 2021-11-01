use candid::{CandidType, Principal};
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<Principal>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}