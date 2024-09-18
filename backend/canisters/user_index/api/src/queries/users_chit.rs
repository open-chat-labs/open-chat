use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Chit, UserId};

#[ts_export(user_index, users_chit)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<UserId>,
    pub year: u16,
    pub month: u8,
}

#[ts_export(user_index, users_chit)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user_index, users_chit)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chit: Vec<Chit>,
}
