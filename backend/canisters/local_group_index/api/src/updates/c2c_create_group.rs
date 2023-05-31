use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{AccessGate, AccessRules, Avatar, ChatId, GroupPermissions, GroupSubtype, Milliseconds, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub created_by_user_id: UserId,
    pub created_by_user_principal: Principal,
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: AccessRules,
    pub subtype: Option<GroupSubtype>,
    pub avatar: Option<Avatar>,
    pub history_visible_to_new_joiners: bool,
    pub permissions: Option<GroupPermissions>,
    pub events_ttl: Option<Milliseconds>,
    pub gate: Option<AccessGate>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CyclesBalanceTooLow,
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
}
