use crate::{read_state, RuntimeState};
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::call::method_name().trim_end_matches("_msgpack").to_string();

    let is_valid = match method_name.as_str() {
        "invite_users_to_channel"
        | "invite_users_to_community"
        | "invite_users_to_group"
        | "join_channel"
        | "join_community"
        | "join_group"
        | "report_message_v2" => state.is_caller_openchat_user(),
        "register_user" => true,
        _ => false,
    };

    if is_valid {
        ic_cdk::api::call::accept_message();
    }
}
