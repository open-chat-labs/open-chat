use crate::{RuntimeState, read_state};
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::msg_method_name().trim_end_matches("_msgpack").to_string();

    let is_valid = match method_name.as_str() {
        "install_bot"
        | "invite_users_to_channel"
        | "invite_users_to_community"
        | "invite_users_to_group"
        | "join_channel"
        | "join_community"
        | "join_group"
        | "uninstall_bot" => state.is_caller_openchat_user(),
        "withdraw_from_icpswap" => state.is_caller_platform_operator(),
        "register_user" => true,
        "remove_notifications" => state.is_caller_notification_pusher(),
        _ => false,
    } || method_name.starts_with("bot_");

    if is_valid {
        ic_cdk::api::accept_message();
    }
}
