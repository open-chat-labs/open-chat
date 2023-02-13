use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    Avatar, CanisterId, FrozenGroupInfo, GroupPermissions, GroupRules, GroupSubtype, Milliseconds, TimestampMillis, UserId,
    Version,
};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: GroupRules,
    pub subtype: Option<GroupSubtype>,
    pub avatar: Option<Avatar>,
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
    pub ledger_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub wasm_version: Version,
    pub test_mode: bool,
    pub is_reinstall: bool,
    pub date_created_override: Option<TimestampMillis>,
    pub invite_code: Option<u64>,
    pub invite_code_enabled: bool,
    pub frozen: Option<FrozenGroupInfo>,
}
