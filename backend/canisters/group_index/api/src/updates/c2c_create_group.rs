use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{Avatar, ChatId, GroupPermissions, GroupSubtype};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub creator_principal: Principal,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub subtype: Option<GroupSubtype>,
    pub avatar: Option<Avatar>,
    pub history_visible_to_new_joiners: bool,
    pub permissions: Option<GroupPermissions>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTaken,
    CyclesBalanceTooLow,
    InternalError,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
}
