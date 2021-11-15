use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::inspect_message;

#[inspect_message]
fn inspect_message() {
    RUNTIME_STATE.with(|state| accept_if_valid(state.borrow().as_ref().unwrap()));
}

fn accept_if_valid(runtime_state: &RuntimeState) {
    let method_name = ic_cdk::api::call::method_name();

    // 'inspect_message' only applies to ingress messages so calls to c2c methods should be rejected
    let is_c2c_method = method_name.starts_with("c2c") || method_name == "wallet_receive";
    if is_c2c_method {
        return;
    }

    let caller = runtime_state.env.caller();
    if let Some(role) = runtime_state.data.participants.get_by_principal(&caller).map(|p| p.role) {
        let is_public_group = runtime_state.data.is_public;
        let is_valid = match method_name.as_str() {
            "add_participants" => role.can_add_participants(is_public_group),
            "block_user" => role.can_block_user(),
            "delete_group" => role.can_delete_group(),
            "make_admin" => role.can_make_admin(),
            "dismiss_admin" => role.can_dismiss_admin(),
            "remove_participant" => role.can_remove_participants(),
            "transfer_ownership" => role.can_transfer_ownership(),
            "unblock_user" => role.can_unblock_user(),
            "update_group" => role.can_update_group(),
            "delete_message" | "edit_message" | "put_chunk" | "send_message" | "toggle_reaction" => true,
            _ => false,
        };

        if is_valid {
            ic_cdk::api::call::accept_message();
        }
    }
}
