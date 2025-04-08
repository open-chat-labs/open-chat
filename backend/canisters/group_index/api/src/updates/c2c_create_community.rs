use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{AccessGateConfig, CanisterId, CommunityId, CommunityPermissions, Document, Rules};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: Rules,
    pub avatar: Option<Document>,
    pub banner: Option<Document>,
    pub history_visible_to_new_joiners: bool,
    pub permissions: Option<CommunityPermissions>,
    pub gate_config: Option<AccessGateConfig>,
    pub default_channels: Vec<String>,
    pub default_channel_rules: Option<Rules>,
    pub primary_language: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NameTaken,
    UserNotFound,
    InternalError(String),
    Error(OCError),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
}
