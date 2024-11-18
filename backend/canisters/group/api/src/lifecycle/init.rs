use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    AccessGate, AccessGateConfig, BuildVersion, CanisterId, Document, GroupPermissions, GroupSubtype, Milliseconds, Rules,
    UserId, UserType,
};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
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
    pub created_by_principal: Principal,
    pub created_by_user_id: UserId,
    #[serde(default)]
    pub created_by_user_type: UserType,
    pub events_ttl: Option<Milliseconds>,
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
    pub gate: Option<AccessGate>,
    pub gate_config: Option<AccessGateConfig>,
    pub video_call_operators: Vec<Principal>,
    #[serde(with = "serde_bytes")]
    pub ic_root_key: Vec<u8>,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
