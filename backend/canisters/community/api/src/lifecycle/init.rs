use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{UserId, Version, GroupRules, Avatar, CommunityPermissions, Milliseconds, CanisterId, GroupGate};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: GroupRules,
    pub avatar: Option<Avatar>,
    pub history_visible_to_new_joiners: bool,
    pub permissions: Option<CommunityPermissions>,
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
    pub gate: Option<GroupGate>,
    pub wasm_version: Version,
    pub test_mode: bool,
}
