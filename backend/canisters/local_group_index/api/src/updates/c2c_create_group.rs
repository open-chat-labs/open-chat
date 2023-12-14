use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    local_user_index_canister_id, AccessGate, CanisterId, ChatId, Document, GroupPermissions, GroupSubtype, Milliseconds,
    Rules, UserId,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub created_by_user_id: UserId,
    pub created_by_user_principal: Principal,
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: Rules,
    pub subtype: Option<GroupSubtype>,
    pub avatar: Option<Document>,
    pub history_visible_to_new_joiners: bool,
    pub permissions_v2: Option<GroupPermissions>,
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
    pub local_user_index_canister_id: CanisterId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResultPrevious {
    pub chat_id: ChatId,
}

impl From<SuccessResultPrevious> for SuccessResult {
    fn from(value: SuccessResultPrevious) -> Self {
        SuccessResult {
            chat_id: value.chat_id,
            local_user_index_canister_id: local_user_index_canister_id(value.chat_id.into()),
        }
    }
}
