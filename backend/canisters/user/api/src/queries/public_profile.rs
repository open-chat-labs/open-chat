use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Empty, TimestampMillis};

pub type Args = Empty;

#[ts_export(user, public_profile)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PublicProfile),
}

#[ts_export(user, public_profile)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PublicProfile {
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
    pub profile_background_id: Option<u128>,
    pub bio: String,
    pub is_premium: bool,
    pub phone_is_verified: bool,
    pub created: TimestampMillis,
}
