use crate::Summary;
use candid::{CandidType, Principal};
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
    pub as_super_admin: bool,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(Summary),
    AlreadyInGroup,
    GroupNotPublic,
    Blocked,
    ParticipantLimitReached(u32),
    NotSuperAdmin,
    InternalError(String),
}
