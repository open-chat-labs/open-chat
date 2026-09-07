use crate::model::ai_app_call_throttle::AiAppCallKind;
use crate::model::ai_app_link_codes::{AiAppLinkCode, ClaimLinkCodeResult, is_valid_claim_token};
use crate::updates::remove_my_ai_app_key::invalidate_pending_ai_app_link_state;
use crate::updates::set_my_ai_app_key::validate_user_public_key;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use oc_error_codes::OCErrorCode;
use user_index_canister::c2c_claim_ai_app_link_code::{Response::*, *};

// No static caller guard: the permitted caller is data-dependent and must equal the exact canister
// pinned into the code at issuance. Authentication happens before code consumption.
#[update(candid = true, msgpack = true)]
fn c2c_claim_ai_app_link_code(args: Args) -> Response {
    mutate_state(|state| c2c_claim_ai_app_link_code_impl(args, state))
}

fn c2c_claim_ai_app_link_code_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    if !crate::pr2_entropy::is_ready(state) {
        return Error(OCErrorCode::C2CError.with_message("link token service temporarily unavailable"));
    }
    if let Err(retry_after_ms) = state.data.ai_app_call_throttle.check(AiAppCallKind::Claim, caller, now) {
        return Error(OCErrorCode::Throttled.with_message(retry_after_ms));
    }
    if !is_valid_claim_token(&args.code) {
        state
            .data
            .ai_app_call_throttle
            .record_failure(AiAppCallKind::Claim, caller, now);
        return CodeNotFound;
    }

    let this_canister_id = state.env.canister_id();
    let link = match state.data.ai_app_link_codes.lookup(&args.code, this_canister_id, now) {
        ClaimLinkCodeResult::Valid(link) => link,
        ClaimLinkCodeResult::Expired => return CodeExpired,
        ClaimLinkCodeResult::NotFound => {
            state
                .data
                .ai_app_call_throttle
                .record_failure(AiAppCallKind::Claim, caller, now);
            return CodeNotFound;
        }
    };

    // A stolen code cannot be rebound by any user/browser/other canister, and a failed attempt does
    // not consume it for the legitimate app.
    if caller != link.app_canister_id {
        state
            .data
            .ai_app_call_throttle
            .record_failure(AiAppCallKind::Claim, caller, now);
        return NotAuthorized;
    }
    let inbox_canister_id = match state.data.ai_apps.get(link.app_id) {
        Some(app)
            if app.published
                && app.manifest.per_user_keys
                && app.updated == link.app_revision
                && app.manifest.app_canister_id == Some(link.app_canister_id) =>
        {
            match app.manifest.inbox_canister_id {
                Some(inbox_canister_id) => inbox_canister_id,
                None => return InvalidRequest("the app has no dedicated ActionInbox route".to_string()),
            }
        }
        _ => return InvalidRequest("the app registration changed; create a new link code".to_string()),
    };
    if state.data.ai_app_user_keys.binding_epoch(link.user_id, link.app_id) != link.consent_epoch {
        // Consume a stale same-app code so repeated delayed claims stay NotFound. A wrong caller was
        // rejected above and therefore still cannot burn a legitimate user's live code.
        let _ = state.data.ai_app_link_codes.claim_bound(&args.code, this_canister_id, now);
        return CodeNotFound;
    }

    let public_key = match validate_user_public_key(&args.public_key) {
        Ok(public_key) => public_key,
        Err(message) => {
            state
                .data
                .ai_app_call_throttle
                .record_failure(AiAppCallKind::Claim, caller, now);
            return InvalidRequest(message);
        }
    };
    let app_subject = match state.data.ai_app_scoped_identity_key.app_subject(
        this_canister_id,
        link.app_id,
        link.app_canister_id,
        link.user_id,
    ) {
        Ok(subject) => subject,
        Err(_) => return InvalidRequest("app-scoped identity service is unavailable".to_string()),
    };
    let consumer_queue_selector = match state.data.ai_app_scoped_identity_key.consumer_queue_selector(
        this_canister_id,
        link.app_id,
        link.app_canister_id,
        inbox_canister_id,
        &public_key,
    ) {
        Ok(selector) => selector,
        Err(_) => return InvalidRequest("app-scoped queue selector service is unavailable".to_string()),
    };

    let consumed = match state.data.ai_app_link_codes.claim_bound(&args.code, this_canister_id, now) {
        ClaimLinkCodeResult::Valid(link) => link,
        ClaimLinkCodeResult::Expired => return CodeExpired,
        ClaimLinkCodeResult::NotFound => return CodeNotFound,
    };
    debug_assert_eq!(consumed.user_id, link.user_id);
    debug_assert_eq!(consumed.app_id, link.app_id);

    if let Err(error) = state
        .data
        .ai_app_user_keys
        .claim_canonical(link.user_id, link.app_id, public_key)
    {
        restore_link_code(&args.code, &link, now, state);
        InvalidRequest(error.message())
    } else {
        invalidate_pending_ai_app_link_state(link.user_id, link.app_id, state);
        let key_version = state
            .data
            .ai_app_user_keys
            .binding_version(link.user_id, link.app_id)
            .expect("a successful key claim must have a binding version");
        Success(SuccessResult {
            app_subject: serde_bytes::ByteBuf::from(app_subject.to_vec()),
            subject_version: user_index_canister::c2c_claim_ai_app_link_code::APP_SUBJECT_VERSION_V1,
            app_id: link.app_id,
            app_revision: link.app_revision,
            app_canister_id: link.app_canister_id,
            consumer_queue_selector: serde_bytes::ByteBuf::from(consumer_queue_selector.to_vec()),
            consumer_queue_selector_version:
                user_index_canister::c2c_claim_ai_app_link_code::CONSUMER_QUEUE_SELECTOR_VERSION_V1,
            key_version,
        })
    }
}

fn restore_link_code(code: &str, link: &AiAppLinkCode, now: u64, state: &mut RuntimeState) {
    state
        .data
        .ai_app_link_codes
        .insert_bound(
            code.to_string(),
            state.env.canister_id(),
            link.user_id,
            link.app_id,
            link.app_revision,
            link.app_canister_id,
            link.consent_epoch,
            link.expires,
            now,
        )
        .expect("a just-consumed AI-app link code must be restorable");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use candid::Principal;
    use p256_key_pair::P256KeyPair;
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use types::{AiAppId, AiAppManifest, UserId};
    use utils::env::test::TestEnv;

    const CODE: &str = "abababababababababababababababababababababababababababababababab";

    fn valid_key() -> String {
        P256KeyPair::new(&mut StdRng::seed_from_u64(41)).public_key_pem().to_string()
    }

    fn manifest(app_canister_id: Principal, description: &str) -> AiAppManifest {
        AiAppManifest {
            name: "generic-link-app".to_string(),
            description: description.to_string(),
            icon_url: None,
            app_canister_id: Some(app_canister_id),
            inbox_canister_id: Some(Principal::from_slice(&[12])),
            consumer_public_key: String::new(),
            per_user_keys: true,
            actions: Vec::new(),
            surfaces: Vec::new(),
        }
    }

    fn state_with_link(caller: Principal, bound_app_canister: Principal) -> (RuntimeState, UserId, AiAppId, u64) {
        let env = TestEnv {
            now: 10,
            caller,
            ..Default::default()
        };
        let this_canister_id = env.canister_id;
        let owner: UserId = Principal::from_slice(&[55]).into();
        let mut data = Data::default();
        let app = data
            .ai_apps
            .register(owner, manifest(bound_app_canister, "v1"), env.now, true)
            .unwrap();
        assert!(data.ai_apps.publish(app.id, env.now));
        let revision = data.ai_apps.get(app.id).unwrap().updated;
        data.ai_app_link_codes
            .insert_bound(
                CODE.to_string(),
                this_canister_id,
                owner,
                app.id,
                revision,
                bound_app_canister,
                0,
                env.now + 1_000,
                env.now,
            )
            .unwrap();
        data.ai_app_scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(98))
            .unwrap();
        (RuntimeState::new(Box::new(env), data), owner, app.id, revision)
    }

    #[test]
    fn wrong_caller_cannot_consume_a_stolen_code() {
        let app_canister = Principal::from_slice(&[8]);
        let attacker = Principal::from_slice(&[9]);
        let (mut state, _, _, _) = state_with_link(attacker, app_canister);
        assert!(matches!(
            c2c_claim_ai_app_link_code_impl(
                Args {
                    code: CODE.to_string(),
                    public_key: valid_key(),
                },
                &mut state,
            ),
            NotAuthorized
        ));
        assert!(state.data.ai_app_link_codes.contains_bound(CODE, state.env.canister_id()));
    }

    #[test]
    fn exact_app_claim_returns_bound_identity_and_is_single_use() {
        let app_canister = Principal::from_slice(&[8]);
        let (mut state, user_id, app_id, app_revision) = state_with_link(app_canister, app_canister);
        state
            .data
            .ai_app_scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(99))
            .unwrap();
        let expected_subject = state
            .data
            .ai_app_scoped_identity_key
            .app_subject(state.env.canister_id(), app_id, app_canister, user_id)
            .unwrap();
        let expected_selector = state
            .data
            .ai_app_scoped_identity_key
            .consumer_queue_selector(
                state.env.canister_id(),
                app_id,
                app_canister,
                Principal::from_slice(&[12]),
                &valid_key(),
            )
            .unwrap();
        assert!(matches!(
            c2c_claim_ai_app_link_code_impl(
                Args {
                    code: CODE.to_string(),
                    public_key: valid_key(),
                },
                &mut state,
            ),
            Success(SuccessResult {
                app_subject,
                subject_version,
                app_id: claimed_app,
                app_revision: claimed_revision,
                app_canister_id: claimed_canister,
                consumer_queue_selector,
                consumer_queue_selector_version,
                key_version,
            }) if app_subject.as_ref() == expected_subject
                && subject_version == user_index_canister::c2c_claim_ai_app_link_code::APP_SUBJECT_VERSION_V1
                && consumer_queue_selector.as_ref() == expected_selector
                && consumer_queue_selector_version
                    == user_index_canister::c2c_claim_ai_app_link_code::CONSUMER_QUEUE_SELECTOR_VERSION_V1
                && claimed_app == app_id
                && claimed_revision == app_revision
                && claimed_canister == app_canister
                && key_version == 1
        ));
        assert_ne!(
            expected_subject.as_slice(),
            user_id.as_slice(),
            "the app must not receive the global OpenChat user id"
        );
        assert!(matches!(
            c2c_claim_ai_app_link_code_impl(
                Args {
                    code: CODE.to_string(),
                    public_key: valid_key(),
                },
                &mut state,
            ),
            CodeNotFound
        ));
    }

    #[test]
    fn consent_epoch_change_makes_a_delayed_same_app_claim_not_found() {
        let app_canister = Principal::from_slice(&[8]);
        let (mut state, user_id, app_id, _) = state_with_link(app_canister, app_canister);
        // Exercise the epoch defense independently of the endpoint's O(1) code deletion, covering
        // a stale/migrated index row that survives explicit cancellation.
        assert_eq!(state.data.ai_app_user_keys.remove(user_id, app_id), Ok(false));

        assert!(matches!(
            c2c_claim_ai_app_link_code_impl(
                Args {
                    code: CODE.to_string(),
                    public_key: valid_key(),
                },
                &mut state,
            ),
            CodeNotFound
        ));
        assert!(!state.data.ai_app_link_codes.contains_bound(CODE, state.env.canister_id()));
    }

    #[test]
    fn revision_rotation_invalidates_without_consuming_the_code() {
        let app_canister = Principal::from_slice(&[8]);
        let (mut state, owner, app_id, _) = state_with_link(app_canister, app_canister);
        state
            .data
            .ai_apps
            .register(owner, manifest(app_canister, "v2"), 11, true)
            .unwrap();
        assert!(matches!(
            c2c_claim_ai_app_link_code_impl(
                Args {
                    code: CODE.to_string(),
                    public_key: valid_key(),
                },
                &mut state,
            ),
            InvalidRequest(_)
        ));
        assert!(!state.data.ai_apps.get(app_id).unwrap().published);
        assert!(state.data.ai_app_link_codes.contains_bound(CODE, state.env.canister_id()));
    }
}
