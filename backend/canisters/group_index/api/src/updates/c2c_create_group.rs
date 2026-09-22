use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{AccessGateConfig, CanisterId, ChatId, Document, GroupPermissions, GroupSubtype, Milliseconds, Rules, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: Rules,
    pub subtype: Option<GroupSubtype>,
    pub avatar: Option<Document>,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: Option<bool>,
    pub permissions_v2: Option<GroupPermissions>,
    pub events_ttl: Option<Milliseconds>,
    pub gate_config: Option<AccessGateConfig>,
    // The user being acted for when the caller holds many users, which must be one of its users
    #[serde(default)]
    pub user_id: Option<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTaken,
    CyclesBalanceTooLow,
    UserNotFound,
    InternalError,
    Error(OCError),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
}
