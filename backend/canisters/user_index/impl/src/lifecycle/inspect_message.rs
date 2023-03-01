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
        "create_canister" | "mark_as_online" | "pay_for_diamond_membership" | "set_username" | "mark_suspected_bot" => {
            let caller = runtime_state.env.caller();
            let is_user = runtime_state.data.users.get_by_principal(&caller).is_some();
            is_user
        }
        "suspend_user" | "unsuspend_user" => runtime_state.is_caller_platform_moderator(),
        "add_platform_moderator"
        | "set_governance_principals"
        | "remove_platform_moderator"
        | "set_max_concurrent_user_canister_upgrades"
        | "add_local_user_index_canister"
        | "upgrade_user_canister_wasm"
        | "upgrade_local_user_index_canister_wasm"
        | "mark_local_user_index_full"
        | "suspected_bots" => runtime_state.is_caller_governance_principal(),
        "create_challenge" | "notify_registration_fee_paid" | "register_user" => true,
        _ => false,
    };

    if is_valid {
        ic_cdk::api::call::accept_message();
    }
}
