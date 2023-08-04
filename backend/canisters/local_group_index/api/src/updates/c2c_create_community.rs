use candid::Principal;
use serde::{Deserialize, Serialize};
use types::{AccessGate, AccessRules, CommunityId, CommunityPermissions, Document, SourceGroup, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub created_by_user_id: UserId,
    pub created_by_user_principal: Principal,
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: AccessRules,
    pub avatar: Option<Document>,
    pub banner: Option<Document>,
    pub history_visible_to_new_joiners: bool,
    pub permissions: Option<CommunityPermissions>,
    pub gate: Option<AccessGate>,
    pub default_channels: Vec<String>,
    pub source_group: Option<SourceGroup>,
    pub primary_language: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InternalError(String),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub community_id: CommunityId,
}
