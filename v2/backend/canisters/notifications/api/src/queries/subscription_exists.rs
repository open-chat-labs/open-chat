use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub p256dh_key: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Yes,
    No,
}
