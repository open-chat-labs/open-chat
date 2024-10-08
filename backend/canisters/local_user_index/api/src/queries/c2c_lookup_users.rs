use std::collections::HashMap;

use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

use crate::GlobalUser;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(HashMap<UserId, GlobalUser>),
}
