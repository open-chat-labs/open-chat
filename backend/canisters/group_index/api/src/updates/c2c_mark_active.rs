use candid::CandidType;
use serde::Deserialize;
use types::{Milliseconds, PublicGroupActivity};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub duration: Milliseconds,
    pub public_group_activity: Option<PublicGroupActivity>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
}
