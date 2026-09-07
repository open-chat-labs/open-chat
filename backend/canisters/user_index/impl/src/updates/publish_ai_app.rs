use crate::guards::caller_is_governance_principal;
use crate::model::ai_app_registry::canonical_app_name;
use crate::{mutate_state, read_state};
use action_inbox_canister::configuration;
use ai_app_verifier_canister::c2c_verify_ai_app_v2::{self, ManifestCommitmentV2, VerificationBindingV2};
use canister_api_macros::{proposal, update};
use canister_tracing_macros::trace;
use tracing::info;
use user_index_canister::publish_ai_app::{Args, Response};

// Publishing makes a registered AI app visible in the directory/explorer for everyone (a new
// registration is private to its owner). Gated like publish_bot: an SNS proposal in production,
// open in test_mode so local deploys can self-publish. Candid-exposed as well as msgpack because
// external apps' deploy scripts drive registration+publication over plain candid.
//
// Before flipping visibility we make an anti-squatting/substitution check: the manifest must
// declare an `app_canister_id`, and that canister must vouch over `c2c_verify_ai_app_v2` for a
// deterministic commitment to this exact registry, owner, canonical name, app id/revision and
// entire manifest. V1's name-only boolean is deliberately not accepted for publication trust.
// The check is a cross-canister call, so this endpoint is async.
#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn publish_ai_app(args: Args) -> Response {
    publish_ai_app_impl(args).await
}

#[update(msgpack = true)]
#[trace]
async fn publish_ai_app(args: Args) -> Response {
    // Same verification runs in test_mode. A registered user may publish only their own app; a
    // standalone deploy identity must be explicitly configured as governance.
    if !read_state(|state| caller_can_publish_test_mode_app(state, args.app_id)) {
        return Response::NotAuthorised;
    }
    publish_ai_app_impl(args).await
}

fn caller_can_publish_test_mode_app(state: &crate::RuntimeState, app_id: types::AiAppId) -> bool {
    let caller = state.env.caller();
    let caller_user_id = state.data.users.get_by_principal(&caller).map(|user| user.user_id);
    let app_owner = state.data.ai_apps.get(app_id).map(|app| app.owner);
    app_owner.is_some_and(|owner| {
        can_publish_test_mode_app(
            state.data.test_mode,
            state.is_caller_governance_principal(),
            caller_user_id,
            owner,
        )
    })
}

fn can_publish_test_mode_app(
    test_mode: bool,
    caller_is_governance: bool,
    caller_user_id: Option<types::UserId>,
    app_owner: types::UserId,
) -> bool {
    test_mode && (caller_is_governance || caller_user_id == Some(app_owner))
}

async fn publish_ai_app_impl(args: Args) -> Response {
    // Resolve the app and its declared canister up front (read-only). Absent id → NotVerified: the
    // anti-squatting gate requires a canister that can vouch.
    let (expected_user_index, app) =
        read_state(|state| (state.env.canister_id(), state.data.ai_apps.get(args.app_id).cloned()));
    let Some(app) = app else {
        return Response::NotFound;
    };
    let Some(app_canister_id) = app.manifest.app_canister_id else {
        return Response::NotVerified;
    };
    let Some(canonical_name) = canonical_app_name(&app.manifest.name) else {
        return Response::NotVerified;
    };
    let verified_revision = app.updated;
    let inbox_canister_id = app.manifest.inbox_canister_id;
    let commitment = ManifestCommitmentV2 {
        user_index_canister_id: expected_user_index,
        app_id: app.id,
        app_revision: verified_revision,
        owner: app.owner.as_principal(),
        canonical_name: canonical_name.clone(),
        manifest: app.manifest.clone(),
    };
    let manifest_hash = match c2c_verify_ai_app_v2::manifest_hash_v2(&commitment) {
        Ok(hash) => hash,
        Err(error) => {
            info!(%error, app_id = app.id, "failed to encode AI app V2 manifest commitment");
            return Response::NotVerified;
        }
    };
    let expected_binding = VerificationBindingV2 {
        user_index_canister_id: expected_user_index,
        app_id: app.id,
        app_revision: verified_revision,
        owner: app.owner.as_principal(),
        canonical_name,
        app_canister_id,
        inbox_canister_id,
        manifest_hash,
    };

    // Ask the app's own canister to vouch for the name. Any non-vouch outcome — false, trap,
    // timeout, decode failure — maps to NotVerified. Never fail open.
    let vouched = match ai_app_verifier_canister_c2c_client::c2c_verify_ai_app_v2(
        app_canister_id,
        &c2c_verify_ai_app_v2::Args {
            binding: expected_binding.clone(),
        },
    )
    .await
    {
        Ok(response) => response_vouches_for(&expected_binding, &response),
        Err(_) => {
            info!(%app_canister_id, app_id = app.id, "c2c_verify_ai_app_v2 failed; treating as not verified");
            false
        }
    };

    if !vouched {
        return Response::NotVerified;
    }

    // An inbox is a separate authority-bearing canister. It must explicitly identify both this
    // registry and this immutable app id. This prevents an app from naming another app's inbox and
    // inducing UserIndex to consume that inbox's quota as a confused deputy. Shared inboxes are
    // intentionally unsupported; one inbox's global quotas belong to exactly one app namespace.
    if let Some(inbox_canister_id) = inbox_canister_id {
        let binding = action_inbox_canister_c2c_client::configuration(inbox_canister_id, &configuration::Args {}).await;
        let valid = matches!(
            binding,
            Ok(configuration::Response::Success(configuration::SuccessResult {
                app_id,
                user_index_canister_id: bound_user_index,
                authorized_depositors,
                ..
            })) if app_id == args.app_id
                && bound_user_index == expected_user_index
                && authorized_depositors == vec![expected_user_index]
        );
        if !valid {
            info!(
                %inbox_canister_id,
                app_id = args.app_id,
                "action inbox is not bound to this app and UserIndex"
            );
            return Response::NotVerified;
        }
    }

    // Re-check the app still exists after the await (it could have been deleted meanwhile), then
    // publish. Unlike bots there is no per-LUI replication to notify — clients query the registry.
    mutate_state(|state| {
        if state
            .data
            .ai_apps
            .publish_if_current(args.app_id, verified_revision, state.env.now())
        {
            Response::Success
        } else if state.data.ai_apps.contains(args.app_id) {
            // The manifest changed, or another publication completed, while verification awaited.
            Response::NotVerified
        } else {
            Response::NotFound
        }
    })
}

fn response_vouches_for(expected: &VerificationBindingV2, response: &c2c_verify_ai_app_v2::Response) -> bool {
    response.vouched && response.binding == *expected
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn principal(value: u8) -> Principal {
        Principal::from_slice(&[value])
    }

    fn expected_binding() -> VerificationBindingV2 {
        VerificationBindingV2 {
            user_index_canister_id: principal(1),
            app_id: 7,
            app_revision: 99,
            owner: principal(2),
            canonical_name: "sampleapp".to_string(),
            app_canister_id: principal(3),
            inbox_canister_id: Some(principal(4)),
            manifest_hash: [5; 32],
        }
    }

    fn response(binding: VerificationBindingV2) -> c2c_verify_ai_app_v2::Response {
        c2c_verify_ai_app_v2::Response { vouched: true, binding }
    }

    #[test]
    fn only_an_exact_v2_echo_is_accepted() {
        let expected = expected_binding();
        assert!(response_vouches_for(&expected, &response(expected.clone())));

        let mut denied = response(expected.clone());
        denied.vouched = false;
        assert!(!response_vouches_for(&expected, &denied));
    }

    #[test]
    fn indexed_owner_cannot_be_replaced_by_another_user_in_the_same_canister() {
        let host = candid::Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 42, 1, 1]);
        let owner = types::UserId::new_indexed(host, 1);
        let other = types::UserId::new_indexed(host, 2);
        let mut expected = expected_binding();
        expected.owner = owner.as_principal();
        assert!(response_vouches_for(&expected, &response(expected.clone())));
        for substitute in [other.as_principal(), host] {
            let mut changed = expected.clone();
            changed.owner = substitute;
            assert!(!response_vouches_for(&expected, &response(changed)));
        }
        assert!(can_publish_test_mode_app(true, false, Some(owner), owner));
        assert!(!can_publish_test_mode_app(true, false, Some(other), owner));
    }

    #[test]
    fn wrong_owner_and_canonical_name_are_rejected() {
        let expected = expected_binding();

        let mut changed = expected.clone();
        changed.owner = principal(8);
        assert!(!response_vouches_for(&expected, &response(changed)));

        let mut changed = expected.clone();
        changed.canonical_name = "different".to_string();
        assert!(!response_vouches_for(&expected, &response(changed)));
    }

    #[test]
    fn hash_substitution_and_stale_revision_are_rejected() {
        let expected = expected_binding();

        let mut changed = expected.clone();
        changed.app_id += 1;
        assert!(!response_vouches_for(&expected, &response(changed)));

        let mut changed = expected.clone();
        changed.manifest_hash[0] ^= 1;
        assert!(!response_vouches_for(&expected, &response(changed)));

        let mut changed = expected.clone();
        changed.app_revision -= 1;
        assert!(!response_vouches_for(&expected, &response(changed)));
    }

    #[test]
    fn copied_app_or_inbox_canister_binding_is_rejected() {
        let expected = expected_binding();

        let mut changed = expected.clone();
        changed.app_canister_id = principal(8);
        assert!(!response_vouches_for(&expected, &response(changed)));

        let mut changed = expected.clone();
        changed.inbox_canister_id = Some(principal(8));
        assert!(!response_vouches_for(&expected, &response(changed)));
    }

    #[test]
    fn four_account_test_mode_publish_is_owner_scoped() {
        let account_a: types::UserId = principal(10).into();
        let account_b: types::UserId = principal(11).into();
        let account_c: types::UserId = principal(12).into();
        let account_d: types::UserId = principal(13).into();

        assert!(can_publish_test_mode_app(true, false, Some(account_a), account_a));
        for other in [account_b, account_c, account_d] {
            assert!(!can_publish_test_mode_app(true, false, Some(other), account_a));
        }
        assert!(can_publish_test_mode_app(true, true, None, account_a));
        assert!(!can_publish_test_mode_app(false, false, Some(account_a), account_a));
    }
}
