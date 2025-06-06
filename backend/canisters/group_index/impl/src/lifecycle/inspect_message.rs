use crate::{RuntimeState, read_state};
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::msg_method_name().trim_end_matches("_msgpack").to_string();

    let is_valid = match method_name.as_str() {
        "add_local_index_canister"
        | "reinstall_group"
        | "set_max_concurrent_community_canister_upgrades"
        | "set_max_concurrent_group_canister_upgrades"
        | "upgrade_community_canister_wasm"
        | "upgrade_group_canister_wasm" => state.is_caller_governance_principal(),
        "upload_wasm_chunk" => state.can_caller_upload_wasm_chunks(),
        "add_hot_group_exclusion"
        | "delete_frozen_group"
        | "freeze_community"
        | "freeze_group"
        | "mark_local_index_full"
        | "remove_hot_group_exclusion"
        | "set_community_moderation_flags"
        | "set_community_upgrade_concurrency"
        | "set_group_upgrade_concurrency"
        | "unfreeze_community"
        | "unfreeze_group" => true,
        "revoke_community_verification"
        | "revoke_group_verification"
        | "set_group_verification"
        | "set_community_verification" => state.is_caller_governance_principal(),
        _ => false,
    };

    if is_valid {
        ic_cdk::api::accept_message();
    }
}
