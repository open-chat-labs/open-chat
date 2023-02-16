use crate::{read_state, RuntimeState};
use ic_cdk_macros::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(runtime_state: &RuntimeState) {
    let method_name = ic_cdk::api::call::method_name();

    // 'inspect_message' only applies to ingress messages so calls to c2c methods should be rejected
    let is_c2c_method = method_name.starts_with("c2c") || method_name == "wallet_receive";
    if is_c2c_method {
        return;
    }

    let is_valid = match method_name.as_str() {
        "add_local_group_index_canister"
        | "mark_local_group_index_full"
        | "reinstall_group"
        | "set_governance_principals"
        | "set_max_concurrent_group_canister_upgrades"
        | "upgrade_group_canister_wasm"
        | "upgrade_local_group_index_canister_wasm" => runtime_state.is_caller_governance_principal(),
        "delete_frozen_group" | "freeze_group" | "unfreeze_group" => true,
        _ => false,
    };

    if is_valid {
        ic_cdk::api::call::accept_message();
    }
}
