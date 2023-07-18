use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{AccessGate, AccessRules, ChannelId, CommunityId, CommunityPermissions, Document, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub user_id: UserId,
    pub user_principal: Principal,
    pub name: String,
    pub description: String,
    pub rules: AccessRules,
    pub avatar: Option<Document>,
    pub permissions: Option<CommunityPermissions>,
    pub gate: Option<AccessGate>,
    pub primary_language: String,
    pub history_visible_to_new_joiners: bool,
    pub total_bytes: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CommunityId),
    InternalError(String),
}
