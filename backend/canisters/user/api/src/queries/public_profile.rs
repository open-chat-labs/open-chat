use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Avatar;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PublicProfile),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PublicProfile {
    pub username: String,
    pub avatar: Option<Avatar>,
    pub bio: String,
    pub is_premium: bool,
    pub phone_is_verified: bool,
}
