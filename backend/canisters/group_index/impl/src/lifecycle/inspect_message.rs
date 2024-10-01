use crate::{read_state, RuntimeState};
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::call::method_name().trim_end_matches("_msgpack").to_string();

    // 'inspect_message' only applies to ingress messages so calls to c2c methods should be rejected
    let is_c2c_method = method_name.starts_with("c2c") || method_name == "wallet_receive";
    if is_c2c_method {
        return;
    }

    let is_valid = match method_name.as_str() {
        "add_local_group_index_canister"
        | "reinstall_group"
        | "set_max_concurrent_community_canister_upgrades"
        | "set_max_concurrent_group_canister_upgrades"
        | "upgrade_community_canister_wasm"
        | "upgrade_group_canister_wasm"
        | "upgrade_local_group_index_canister_wasm" => state.is_caller_governance_principal(),
        "upload_wasm_chunk" => state.can_caller_upload_wasm_chunks(),
        "add_hot_group_exclusion"
        | "delete_frozen_group"
        | "freeze_group"
        | "mark_local_group_index_full"
        | "remove_hot_group_exclusion"
        | "set_community_moderation_flags"
        | "set_community_upgrade_concurrency"
        | "set_group_upgrade_concurrency"
        | "unfreeze_group" => true,
        _ => false,
    };

    if is_valid {
        ic_cdk::api::call::accept_message();
    }
}
