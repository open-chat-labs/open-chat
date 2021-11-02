use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub alert_id: u32,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    AlertNotFound,
}
