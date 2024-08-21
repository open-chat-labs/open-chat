use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{Chit, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, users_chit)]
pub struct Args {
    pub users: Vec<UserId>,
    pub year: u16,
    pub month: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, users_chit)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, users_chit)]
pub struct SuccessResult {
    pub chit: Vec<Chit>,
}
