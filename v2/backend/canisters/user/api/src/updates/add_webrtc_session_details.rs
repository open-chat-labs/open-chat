use candid::CandidType;
use serde::Deserialize;
use types::webrtc::SessionDetails;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub session_details: SessionDetails,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
    UserNotFound,
}
