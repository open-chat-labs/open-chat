use std::fs;
use std::path::{Path, PathBuf};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../..")
        .canonicalize()
        .expect("resolve repository root")
}

fn read_repo_file(relative_path: &str) -> String {
    let path = repo_root().join(relative_path);
    fs::read_to_string(&path).unwrap_or_else(|error| panic!("read {}: {error}", path.display()))
}

fn shared_rejection_log_is_redacted(source: &str) -> bool {
    // The upstream typed C2CError accessor replaces the old local error_code binding.
    // Permit formatting changes, but keep an exact allowlist for the shared error log.
    let compact: String = source.split_whitespace().collect();
    let logs: Vec<_> = compact
        .split("tracing::error!(")
        .skip(1)
        .map(|body| body.split(");").next().expect("macro body"))
        .collect();
    logs == ["method_name,%canister_id,error_code=?error.reject_code(),\"Errorcallingc2c\""]
}

#[test]
fn every_app_controlled_verifier_and_attestation_wait_is_bounded() {
    let verifier_client = read_repo_file("backend/external_canisters/ai_app_verifier/c2c_client/src/lib.rs");
    for method in [
        "c2c_attest_ai_app_card_confirmation_v1",
        "c2c_attest_ai_app_card_v1",
        "c2c_verify_ai_app",
        "c2c_verify_ai_app_v2",
    ] {
        assert!(
            verifier_client.contains(&format!("generate_candid_c2c_call!({method}, timeout_seconds = 10)")),
            "{method} must use a bounded wait"
        );
    }

    let inbox_client = read_repo_file("backend/canisters/action_inbox/c2c_client/src/lib.rs");
    assert!(inbox_client.contains("generate_c2c_call!(configuration, 10)"));
    assert!(inbox_client.contains("generate_c2c_call!(c2c_notify_actions, 10)"));

    let common_client = read_repo_file("backend/libraries/canister_client/src/lib.rs");
    assert!(
        shared_rejection_log_is_redacted(&common_client),
        "shared rejection logs must contain only the method, canister and typed reject code"
    );
}

#[test]
fn shared_rejection_log_contract_rejects_remote_text_and_extra_fields() {
    let source = read_repo_file("backend/libraries/canister_client/src/lib.rs");
    assert!(shared_rejection_log_is_redacted(&source));
    for unsafe_fields in ["?error", "error_code = ?error", "error_code = ?error.reject_code(), ?error"] {
        let changed = source.replace("error_code = ?error.reject_code()", unsafe_fields);
        assert_ne!(changed, source, "mutation must exercise the actual log fields");
        assert!(!shared_rejection_log_is_redacted(&changed), "must reject {unsafe_fields}");
    }
    assert!(!shared_rejection_log_is_redacted(&format!(
        "{source}\ntracing::error!(?error, \"private reply\");"
    )));
    assert!(!shared_rejection_log_is_redacted(""));
}

#[test]
fn card_attestation_reserves_before_the_third_party_await_and_revalidates_afterward() {
    for (path, call) in [
        (
            "backend/canisters/user_index/impl/src/updates/create_ai_app_card_provenance.rs",
            "ai_app_verifier_canister_c2c_client::c2c_attest_ai_app_card_v1",
        ),
        (
            "backend/canisters/user_index/impl/src/updates/c2c_create_ai_app_card_confirmation_grant.rs",
            "ai_app_verifier_canister_c2c_client::c2c_attest_ai_app_card_confirmation_v1",
        ),
    ] {
        let source = read_repo_file(path);
        let admission = source.find("admit_card_attestation").expect("pre-await admission");
        let remote_call = source.find(call).expect("third-party attestation call");
        let finish = source[remote_call..]
            .find("finish_card_attestation")
            .map(|offset| remote_call + offset)
            .expect("post-await reservation release");
        assert!(
            admission < remote_call,
            "{path} must reserve capacity before awaiting the app"
        );
        assert!(remote_call < finish, "{path} must retain capacity through the app await");
        assert!(
            source.contains("resolve_current_card_app"),
            "{path} must revalidate exact app id/revision/action after the await"
        );
        assert!(
            !source.contains("canister_tracing_macros::trace") && !source.lines().any(|line| line.trim() == "#[trace]"),
            "{path} must not trace card or confirmation payloads"
        );
    }

    let provenance = read_repo_file("backend/canisters/user_index/impl/src/updates/create_ai_app_card_provenance.rs");
    assert!(
        provenance.contains("get_by_principal(&prepared.caller)"),
        "the captured authenticated OpenChat principal must be revalidated after the verifier await"
    );
    let mint = provenance
        .split("fn mint_ai_app_card_provenance")
        .nth(1)
        .expect("post-await provenance mint");
    assert!(
        !mint.contains("state.env.caller()"),
        "the verifier callback caller must never replace the principal captured before the await"
    );

    let confirmation =
        read_repo_file("backend/canisters/user_index/impl/src/updates/c2c_create_ai_app_card_confirmation_grant.rs");
    let consume = confirmation
        .find("ai_app_card_authority::consume")
        .expect("post-attestation authority consume");
    let mint = confirmation.find("mint(prepared, state)").expect("grant mint");
    assert!(consume < mint, "the exact LUI/card authority must be consumed before minting");
}

#[test]
fn throttle_has_caller_app_global_attempt_buckets_and_aggregate_only_metrics() {
    let source = read_repo_file("backend/canisters/user_index/impl/src/model/ai_app_call_throttle.rs");
    for field in [
        "card_attestation_attempts: HashMap<Principal",
        "card_attestation_attempts_by_caller_app",
        "card_attestation_attempts_by_app",
        "card_attestation_attempts_global",
        "card_attestation_in_flight",
    ] {
        assert!(source.contains(field), "missing attestation bound: {field}");
    }
    assert!(source.contains("AiAppCardAttestationMetrics"));
    for sensitive in ["Principal", "AiAppId", "payload", "content_hash", "remote_error"] {
        let metrics = source
            .split("pub struct AiAppCardAttestationMetrics")
            .nth(1)
            .and_then(|tail| tail.split('}').next())
            .expect("metrics struct body");
        assert!(!metrics.contains(sensitive), "metrics must not expose {sensitive}");
    }
}

#[test]
fn external_attestation_contracts_expose_only_app_scoped_correlation() {
    for path in [
        "backend/external_canisters/ai_app_verifier/api/src/updates/c2c_attest_ai_app_card_v1.rs",
        "backend/external_canisters/ai_app_verifier/api/src/updates/c2c_attest_ai_app_card_confirmation_v1.rs",
    ] {
        let source = read_repo_file(path);
        assert!(source.contains("AppScopedCardContext"), "{path} must use app-scoped handles");
        for raw in [
            "AiAppCardContext",
            "UserId",
            "user_id",
            "pub chat:",
            "chat_key",
            "message_id",
            "thread_root_message_index",
        ] {
            assert!(!source.contains(raw), "{path} leaks raw OpenChat authority field {raw}");
        }
    }

    let initial = read_repo_file("backend/external_canisters/ai_app_verifier/api/src/updates/c2c_attest_ai_app_card_v1.rs");
    assert!(initial.contains("pub content: AiAppCardContentV1"));
    assert!(initial.contains("pub authority_content_hash: [u8; 32]"));
}
