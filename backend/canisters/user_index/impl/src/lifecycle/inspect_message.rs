use crate::{RuntimeState, read_state};
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::msg_method_name().trim_end_matches("_msgpack").to_string();

    let is_valid = match method_name.as_str() {
        // Deliberately callable while suspended: contesting an automated sanction is the
        // GDPR Art 22 human-intervention safeguard, and the caller is suspended by definition
        "contest_moderation_sanction"
        | "accept_terms"
        | "claim_daily_chit"
        | "create_canister"
        | "delete_user"
        | "mark_as_online"
        | "mark_suspected_bot"
        | "pay_for_diamond_membership"
        | "pay_for_premium_item"
        | "register_bot"
        | "set_display_name"
        | "set_hide_online_status"
        | "set_moderation_flags"
        | "set_username"
        | "submit_proof_of_unique_personhood"
        | "update_bot"
        | "update_diamond_membership_subscription" => state.is_caller_openchat_user(),
        "resolve_moderation_report" | "suspend_user" | "unsuspend_user" => state.is_caller_platform_moderator(),
        // The filing window can only be opened by a vault reviewer, which is a subset of the
        // platform moderators; the tighter check runs in the endpoint itself
        "authority_report_token" => state.is_caller_platform_moderator(),
        // Service path (authority reporter) or operator reconciliation
        "record_authority_report_attempt" => state.is_caller_authority_reporter(),
        "clear_authority_report_attempt" => state.is_caller_authority_reporter() || state.is_caller_platform_operator(),
        // The dual-authorized actions (destroy_vault_evidence, set_vault_reviewers,
        // set_openai_api_key, set_internal_moderation_channel) are no longer callable
        // directly - they are reachable only through this propose/confirm pair
        "propose_protected_action"
        | "confirm_protected_action"
        | "cancel_protected_action"
        | "set_vault_legal_hold"
        | "set_diamond_membership_fees"
        | "set_moderation_referral_config"
        | "set_premium_item_cost"
        | "set_user_upgrade_concurrency"
        | "update_blocked_username_patterns" => state.is_caller_platform_operator(),
        "record_authority_report_filed" => state.is_caller_platform_operator() || state.is_caller_authority_reporter(),
        "upload_wasm_chunk" => state.can_caller_upload_wasm_chunks(),
        "add_platform_moderator"
        | "add_platform_operator"
        | "remove_platform_moderator"
        | "remove_platform_operator"
        | "assign_platform_moderators_group"
        | "set_max_concurrent_user_canister_upgrades"
        | "add_local_user_index_canister"
        | "upgrade_user_canister_wasm"
        | "upgrade_local_user_index_canister_wasm"
        | "mark_local_user_index_full"
        | "register_external_achievement"
        | "publish_bot"
        | "suspected_bots" => state.is_caller_governance_principal(),
        "award_external_achievement" => true,
        "remove_bot" => state.is_caller_governance_principal() || state.is_caller_openchat_user(),
        _ => false,
    };

    if is_valid {
        ic_cdk::api::accept_message();
    }
}
