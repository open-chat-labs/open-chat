use candid::CandidType;
use serde::{Deserialize, Serialize};

// TODO: implement c2c_update_community
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NameTaken,
    CommunityNotFound,
}
