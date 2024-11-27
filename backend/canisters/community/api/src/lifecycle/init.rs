use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    AccessGateConfig, BuildVersion, CanisterId, CommunityPermissions, Document, Milliseconds, Rules, SourceGroup, UserId,
    UserType,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: Rules,
    pub avatar: Option<Document>,
    pub banner: Option<Document>,
    pub permissions: CommunityPermissions,
    pub primary_language: String,
    pub created_by_principal: Principal,
    pub created_by_user_id: UserId,
    #[serde(default)]
    pub created_by_user_type: UserType,
    pub mark_active_duration: Milliseconds,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub local_group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub bot_api_gateway_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub escrow_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub gate_config: Option<AccessGateConfig>,
    pub default_channels: Vec<String>,
    pub default_channel_rules: Option<Rules>,
    pub source_group: Option<SourceGroup>,
    pub video_call_operators: Vec<Principal>,
    #[serde(with = "serde_bytes")]
    pub ic_root_key: Vec<u8>,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
