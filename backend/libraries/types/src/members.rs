use crate::UserId;
use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum MembersResponse {
    Success(MembersResult),
    Error(OCError),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct MembersResult {
    pub members_map: HashMap<MemberType, Vec<UserId>>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum MemberType {
    Owner,
    Admin,
    Moderator,
    Member,
    Blocked,
    Invited,
    Lapsed,
    Bot,
    Webhook,
}
