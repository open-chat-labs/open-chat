use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AccessGateConfig, ChannelId, CommunityId, CommunityPermissions, Document, Rules};

#[ts_export(user, create_community)]
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

#[ts_export(user, create_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(user, create_community)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub community_id: CommunityId,
    pub channels: Vec<(ChannelId, String)>,
}
