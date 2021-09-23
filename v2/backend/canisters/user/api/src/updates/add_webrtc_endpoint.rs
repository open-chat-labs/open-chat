use candid::CandidType;
use serde::Deserialize;
use types::webrtc::Endpoint;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub endpoint: Endpoint,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
