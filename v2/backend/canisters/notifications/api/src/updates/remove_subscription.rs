use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub p256dh_key: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
