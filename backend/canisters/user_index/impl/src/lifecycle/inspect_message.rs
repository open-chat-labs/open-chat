use crate::{RuntimeState, read_state};
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::msg_method_name().trim_end_matches("_msgpack").to_string();

    let permissions = CallerPermissions {
        openchat_user: state.is_caller_openchat_user(),
        test_mode: state.data.test_mode,
        platform_moderator: state.is_caller_platform_moderator(),
        platform_operator: state.is_caller_platform_operator(),
        authority_reporter: state.is_caller_authority_reporter(),
        can_upload_wasm_chunks: state.can_caller_upload_wasm_chunks(),
        governance_principal: state.is_caller_governance_principal(),
    };
    if method_is_valid(&method_name, permissions) {
        ic_cdk::api::accept_message();
    }
}

#[derive(Clone, Copy, Default)]
struct CallerPermissions {
    openchat_user: bool,
    test_mode: bool,
    platform_moderator: bool,
    platform_operator: bool,
    authority_reporter: bool,
    can_upload_wasm_chunks: bool,
    governance_principal: bool,
}

fn method_is_valid(method_name: &str, permissions: CallerPermissions) -> bool {
    match method_name {
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
        | "update_diamond_membership_subscription"
        | "cancel_ai_app_link_code"
        | "cancel_ai_app_chat_link_token"
        | "create_ai_app_link_code"
        | "delete_ai_app"
        | "set_my_ai_app_key"
        | "remove_my_ai_app_key" => permissions.openchat_user,
        // The update handler restricts non-account callers in test mode to exact-name updates of
        // an already-owned standalone app. No app creation or key/link operation shares this path.
        "register_ai_app" => permissions.openchat_user || permissions.test_mode,
        "create_ai_app_card_provenance" => permissions.openchat_user,
        "resolve_moderation_report" | "suspend_user" | "unsuspend_user" => permissions.platform_moderator,
        // The filing window can only be opened by a vault reviewer, which is a subset of the
        // platform moderators; the tighter check runs in the endpoint itself
        "authority_report_token" => permissions.platform_moderator,
        // Service path (authority reporter) or operator reconciliation
        "record_authority_report_attempt" => permissions.authority_reporter,
        "clear_authority_report_attempt" => permissions.authority_reporter || permissions.platform_operator,
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
        | "update_blocked_username_patterns" => permissions.platform_operator,
        "record_authority_report_filed" => permissions.platform_operator || permissions.authority_reporter,
        "upload_wasm_chunk" => permissions.can_upload_wasm_chunks,
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
        | "remove_ai_app"
        | "suspected_bots"
        | "stage_action_signing_key"
        | "activate_action_signing_key" => permissions.governance_principal,
        // Production publication remains governance-only. In test mode the update handler admits
        // only the exact registered app owner (or governance) after looking up `app_id`; the
        // inspect hook cannot decode that ownership proof, so let signed-in users reach it.
        "publish_ai_app" => permissions.governance_principal || (permissions.test_mode && permissions.openchat_user),
        "award_external_achievement" => true,
        "remove_bot" => permissions.governance_principal || permissions.openchat_user,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protected_actions_cannot_regain_direct_ingress_after_app_integration() {
        let all_permissions = CallerPermissions {
            openchat_user: true,
            test_mode: true,
            platform_moderator: true,
            platform_operator: true,
            authority_reporter: true,
            can_upload_wasm_chunks: true,
            governance_principal: true,
        };
        for method in [
            "destroy_vault_evidence",
            "set_vault_reviewers",
            "set_openai_api_key",
            "set_internal_moderation_channel",
            "set_authority_reporter",
            "set_media_scan_config",
        ] {
            for name in [method.to_string(), format!("{method}_msgpack")] {
                assert!(
                    !method_is_valid(name.trim_end_matches("_msgpack"), all_permissions),
                    "{name} must remain reachable only through a confirmed protected action"
                );
            }
        }
    }

    #[test]
    fn protected_action_ingress_remains_operator_only() {
        let operator = CallerPermissions {
            platform_operator: true,
            ..Default::default()
        };
        let other_roles = CallerPermissions {
            openchat_user: true,
            test_mode: true,
            platform_moderator: true,
            authority_reporter: true,
            can_upload_wasm_chunks: true,
            governance_principal: true,
            ..Default::default()
        };
        for method in [
            "propose_protected_action",
            "confirm_protected_action",
            "cancel_protected_action",
        ] {
            for name in [method.to_string(), format!("{method}_msgpack")] {
                let normalized = name.trim_end_matches("_msgpack");
                assert!(method_is_valid(normalized, operator), "{name}");
                assert!(!method_is_valid(normalized, other_roles), "{name}");
                assert!(!method_is_valid(normalized, CallerPermissions::default()), "{name}");
            }
        }
    }

    #[test]
    fn authority_reporting_preserves_distinct_service_and_operator_permissions() {
        for (permissions, expected) in [
            (CallerPermissions::default(), [false, false, false, false]),
            (
                CallerPermissions {
                    authority_reporter: true,
                    ..Default::default()
                },
                [false, true, true, true],
            ),
            (
                CallerPermissions {
                    platform_operator: true,
                    ..Default::default()
                },
                [false, false, true, true],
            ),
            (
                CallerPermissions {
                    platform_moderator: true,
                    ..Default::default()
                },
                [true, false, false, false],
            ),
        ] {
            for (method, allowed) in [
                "authority_report_token",
                "record_authority_report_attempt",
                "clear_authority_report_attempt",
                "record_authority_report_filed",
            ]
            .into_iter()
            .zip(expected)
            {
                for name in [method.to_string(), format!("{method}_msgpack")] {
                    assert_eq!(
                        method_is_valid(name.trim_end_matches("_msgpack"), permissions),
                        allowed,
                        "{name}"
                    );
                }
            }
        }
    }

    #[test]
    fn action_signing_key_lifecycle_ingress_is_governance_only() {
        let governance = CallerPermissions {
            governance_principal: true,
            ..Default::default()
        };
        let account = CallerPermissions {
            openchat_user: true,
            ..Default::default()
        };

        for method in ["stage_action_signing_key", "activate_action_signing_key"] {
            assert!(method_is_valid(method, governance), "{method} must accept governance");
            assert!(
                !method_is_valid(method, CallerPermissions::default()),
                "{method} must reject an unprivileged caller"
            );
            assert!(
                !method_is_valid(method, account),
                "{method} must reject an ordinary OpenChat account"
            );
        }
    }

    #[test]
    fn action_signing_key_lifecycle_msgpack_aliases_use_the_same_policy() {
        for method in ["stage_action_signing_key_msgpack", "activate_action_signing_key_msgpack"] {
            let normalized = method.trim_end_matches("_msgpack");
            assert!(method_is_valid(
                normalized,
                CallerPermissions {
                    governance_principal: true,
                    ..Default::default()
                }
            ));
            assert!(!method_is_valid(normalized, CallerPermissions::default()));
        }
    }

    #[test]
    fn app_publication_ingress_matches_the_test_mode_owner_handler() {
        let governance = CallerPermissions {
            governance_principal: true,
            ..Default::default()
        };
        let test_mode_user = CallerPermissions {
            openchat_user: true,
            test_mode: true,
            ..Default::default()
        };

        assert!(method_is_valid("publish_ai_app", governance));
        assert!(method_is_valid("publish_ai_app", test_mode_user));
        assert!(!method_is_valid(
            "publish_ai_app",
            CallerPermissions {
                openchat_user: true,
                ..Default::default()
            }
        ));
        assert!(!method_is_valid(
            "publish_ai_app",
            CallerPermissions {
                test_mode: true,
                ..Default::default()
            }
        ));
    }
}
