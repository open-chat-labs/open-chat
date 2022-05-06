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

    let caller = runtime_state.env.caller();
    let permissions = &runtime_state.data.permissions;
    if let Some(role) = runtime_state.data.participants.get_by_principal(&caller).map(|p| p.role) {
        let is_public_group = runtime_state.data.is_public;
        let is_valid = match method_name.as_str() {
            "add_participants" => role.can_add_members(permissions, is_public_group) || role.can_block_users(permissions),
            "block_user" => role.can_block_users(permissions),
            "change_role" => {
                let (args,) = ic_cdk::api::call::arg_data::<(group_canister::change_role::Args,)>();
                role.can_change_roles(args.new_role, permissions)
            }
            "delete_group" => role.can_delete_group(),
            "enable_invite_code" | "disable_invite_code" | "reset_invite_code" => role.can_invite_users(permissions),
            "make_private" => role.can_change_group_visibility(),
            "pin_message" => role.can_pin_messages(permissions),
            "remove_participant" => role.can_remove_members(permissions),
            "send_message" => role.can_send_messages(permissions),
            "toggle_reaction" => role.can_react_to_messages(permissions),
            "unblock_user" => role.can_block_users(permissions),
            "unpin_message" => role.can_pin_messages(permissions),
            "update_group" => role.can_update_group(permissions),
            "delete_messages" | "edit_message" | "put_chunk" | "register_poll_vote" => true,
            _ => false,
        };

        if is_valid {
            ic_cdk::api::call::accept_message();
        }
    }
}
