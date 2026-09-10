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
        | "claim_prize"
        | "daily_puzzle_hint"
        | "daily_puzzle_save_grid"
        | "daily_puzzle_start"
        | "daily_puzzle_submit"
        | "invite_users_to_channel"
        | "invite_users_to_community"
        | "invite_users_to_group"
        | "join_channel"
        | "join_community"
        | "join_group"
        | "pay_for_premium_item"
        | "uninstall_bot" => state.is_caller_openchat_user(),
        "reinstate_missed_daily_claims" | "set_daily_puzzle_canister_id" | "withdraw_from_icpswap" => {
            state.is_caller_platform_operator()
        }
        "register_user" => true,
        // Canister callers bypass inspect_message; this only matters for tests that impersonate the daily_puzzle canister
        "c2c_daily_puzzle_push" => state.is_caller_daily_puzzle_canister(),
        "remove_notifications" => state.is_caller_notification_pusher(),
        "submit_media_scan_verdicts" => state.is_caller_media_scanner(),
        _ => false,
    } || method_name.starts_with("bot_");

    if is_valid {
        ic_cdk::api::accept_message();
    }
}
