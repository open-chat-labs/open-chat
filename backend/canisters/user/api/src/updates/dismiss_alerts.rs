use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub alert_ids: Vec<String>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(Vec<String>),
}
