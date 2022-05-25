use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Milliseconds, PublicGroupActivity};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub duration: Milliseconds,
    pub public_group_activity: Option<PublicGroupActivity>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
}
