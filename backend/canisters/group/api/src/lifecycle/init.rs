use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{AccessGate, AccessRules, CanisterId, Document, GroupPermissions, GroupSubtype, Milliseconds, UserId, Version};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: AccessRules,
    pub subtype: Option<GroupSubtype>,
    pub avatar: Option<Document>,
    pub history_visible_to_new_joiners: bool,
    pub permissions: Option<GroupPermissions>,
    pub created_by_principal: Principal,
    pub created_by_user_id: UserId,
    pub events_ttl: Option<Milliseconds>,
    pub mark_active_duration: Milliseconds,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub local_group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub gate: Option<AccessGate>,
    pub wasm_version: Version,
    pub test_mode: bool,
}
