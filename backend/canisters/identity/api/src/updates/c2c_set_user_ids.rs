use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{SuccessOnly, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<(Principal, Option<UserId>)>,
}

pub type Response = SuccessOnly;
