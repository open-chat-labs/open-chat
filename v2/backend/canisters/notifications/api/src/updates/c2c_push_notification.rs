use candid::CandidType;
use serde::Deserialize;
use types::{Notification, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub recipients: Vec<UserId>,
    pub notification: Notification,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
