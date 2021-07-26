use candid::{CandidType, Principal};
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub push_service_principals: Vec<Principal>,
}
