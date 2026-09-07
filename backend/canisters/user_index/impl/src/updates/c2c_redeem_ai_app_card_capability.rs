use crate::model::ai_app_call_throttle::AiAppCallKind;
use crate::model::ai_app_card_tokens::{
    Capability, LookupCapabilityResult, MAX_RECIPIENT_PUBLIC_KEY_BYTES, MIN_RECIPIENT_PUBLIC_KEY_BYTES, TOKEN_BYTES,
};
use crate::updates::c2c_create_ai_app_card_capability::valid_recipient_key_scheme;
use crate::updates::create_ai_app_card_provenance::resolve_current_card_app;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use user_index_canister::c2c_redeem_ai_app_card_capability::{Response::*, *};

// Public Candid is required because the generic external app canister calls this directly. Dynamic
// authorization happens before consumption: a wrong app caller never burns the user's capability.
#[update(candid = true, msgpack = true)]
fn c2c_redeem_ai_app_card_capability(args: Args) -> Response {
    mutate_state(|state| redeem_impl(args, state))
}

fn redeem_impl(args: Args, state: &mut RuntimeState) -> Response {
    if !crate::pr2_entropy::is_ready(state) {
        return InvalidRequest("card capability service temporarily unavailable".to_string());
    }
    let caller = state.env.caller();
    let now = state.env.now();
    if args.token.len() != TOKEN_BYTES {
        return reject_failed_redemption(
            &mut state.data,
            caller,
            now,
            InvalidRequest(format!("token must contain exactly {TOKEN_BYTES} bytes")),
        );
    }
    if !valid_recipient_key_scheme(&args.recipient_key_scheme) {
        return reject_failed_redemption(
            &mut state.data,
            caller,
            now,
            InvalidRequest("invalid recipient key scheme".to_string()),
        );
    }
    if args.recipient_public_key.len() < MIN_RECIPIENT_PUBLIC_KEY_BYTES
        || args.recipient_public_key.len() > MAX_RECIPIENT_PUBLIC_KEY_BYTES
    {
        return reject_failed_redemption(
            &mut state.data,
            caller,
            now,
            InvalidRequest(format!(
                "recipient public key must contain {MIN_RECIPIENT_PUBLIC_KEY_BYTES}..={MAX_RECIPIENT_PUBLIC_KEY_BYTES} bytes"
            )),
        );
    }
    // The app canister is one shared caller for every linked app user. Invalid-token spam must not
    // place that caller into a state where an exact, still-valid capability is rejected before
    // it can even be looked up. The token map lookup is bounded/O(1); only failed verdicts enter
    // the caller failure bucket below. Valid capabilities continue through their exact
    // app/key/scope/current-binding checks and are consumed only at the end.
    let capability = match lookup_redemption_capability(&mut state.data, state.env.canister_id(), &args.token, caller, now) {
        Ok(value) => value,
        Err(response) => return response,
    };
    if !capability_user_exists(&state.data, capability.context.user_id) {
        return AppUnavailable;
    }
    if caller != capability.app_canister_id {
        return reject_failed_redemption(&mut state.data, caller, now, NotAuthorized);
    }
    if args.recipient_key_scheme != capability.recipient_key_scheme
        || args.recipient_public_key != capability.recipient_public_key
    {
        return reject_failed_redemption(
            &mut state.data,
            caller,
            now,
            InvalidRequest("recipient key does not match the capability".to_string()),
        );
    }
    let Some(app) = resolve_current_card_app(
        &state.data.ai_apps,
        capability.context.app_id,
        capability.context.app_revision,
        &capability.context.action_id,
    ) else {
        return AppUnavailable;
    };
    if app.manifest.app_canister_id != Some(capability.app_canister_id) {
        return AppUnavailable;
    }
    let (current_user_key, current_user_key_version) = if app.manifest.per_user_keys {
        let key = state
            .data
            .ai_app_user_keys
            .keys_for_users(capability.context.app_id, &[capability.context.user_id])
            .ok()
            .and_then(|keys| keys.into_iter().next())
            .map(|key| key.public_key);
        let version = state
            .data
            .ai_app_user_keys
            .binding_version(capability.context.user_id, capability.context.app_id);
        (key, version)
    } else {
        (None, None)
    };
    if !app_user_key_binding_matches(
        app.manifest.per_user_keys,
        capability.app_user_key_fingerprint,
        capability.app_user_key_version,
        current_user_key.as_deref().and_then(|key| {
            state
                .data
                .ai_app_scoped_identity_key
                .consumer_queue_selector(
                    state.env.canister_id(),
                    capability.context.app_id,
                    capability.app_canister_id,
                    app.manifest.inbox_canister_id?,
                    key,
                )
                .ok()
        }),
        current_user_key_version,
    ) {
        return AppUnavailable;
    }
    let external_context = match app_scoped_context(
        &capability.context,
        capability.app_canister_id,
        &state.data.ai_app_scoped_identity_key,
        state.env.canister_id(),
    ) {
        Ok(context) => context,
        Err(_) => return AppUnavailable,
    };
    if !state
        .data
        .ai_app_card_tokens
        .consume_capability(state.env.canister_id(), &args.token)
    {
        return NotFound;
    }
    Success(SuccessResult {
        context: external_context,
        content_hash: capability.content_hash,
        app_canister_id: capability.app_canister_id,
        recipient_key_scheme: capability.recipient_key_scheme,
        recipient_public_key: capability.recipient_public_key,
        scope: capability.scope,
        expires_at: capability.expires_at,
    })
}

#[expect(
    clippy::result_large_err,
    reason = "Preserve the existing public response variants returned by this internal redemption boundary"
)]
fn lookup_redemption_capability(
    data: &mut crate::Data,
    canister_id: types::CanisterId,
    token: &[u8],
    caller: candid::Principal,
    now: types::TimestampMillis,
) -> Result<Capability, Response> {
    match data.ai_app_card_tokens.lookup_capability(canister_id, token, now) {
        LookupCapabilityResult::Valid(value) => Ok(*value),
        LookupCapabilityResult::Expired => Err(Expired),
        LookupCapabilityResult::NotFound => Err(reject_failed_redemption(data, caller, now, NotFound)),
    }
}

fn reject_failed_redemption(
    data: &mut crate::Data,
    caller: candid::Principal,
    now: types::TimestampMillis,
    response: Response,
) -> Response {
    if let Err(retry_after_ms) = data.ai_app_call_throttle.check(AiAppCallKind::CardRedeem, caller, now) {
        return InvalidRequest(format!("too many failed redemption attempts; retry in {retry_after_ms}ms"));
    }
    data.ai_app_call_throttle
        .record_failure(AiAppCallKind::CardRedeem, caller, now);
    response
}

pub(crate) fn capability_user_exists(data: &crate::Data, user_id: types::UserId) -> bool {
    data.users.get_by_user_id(&user_id).is_some()
}

pub(crate) fn app_user_key_binding_matches(
    per_user_keys: bool,
    expected_fingerprint: Option<[u8; 32]>,
    expected_version: Option<u64>,
    current_fingerprint: Option<[u8; 32]>,
    current_version: Option<u64>,
) -> bool {
    match (
        per_user_keys,
        expected_fingerprint,
        expected_version,
        current_fingerprint,
        current_version,
    ) {
        (false, None, None, None, None) => true,
        (true, Some(expected_fingerprint), Some(expected_version), Some(current_fingerprint), Some(current_version)) => {
            current_fingerprint == expected_fingerprint && current_version == expected_version
        }
        // Legacy capabilities had no fingerprint or epoch. They must fail closed for a per-user
        // app; either binding on an app-level capability is likewise an invalid mode mismatch.
        _ => false,
    }
}

pub(crate) fn app_scoped_context(
    context: &types::AiAppCardContext,
    app_canister_id: types::CanisterId,
    key: &crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey,
    user_index_canister_id: types::CanisterId,
) -> Result<AppScopedCardContext, String> {
    let (chat_handle, message_handle) = match context.chat {
        types::Chat::Direct(other) => {
            let other_user_id: types::UserId = other.into();
            (
                key.direct_chat_handle(
                    user_index_canister_id,
                    context.app_id,
                    app_canister_id,
                    context.user_id,
                    other_user_id,
                )?,
                key.direct_message_handle(
                    user_index_canister_id,
                    context.app_id,
                    app_canister_id,
                    context.user_id,
                    other_user_id,
                    context.thread_root_message_index,
                    context.message_id,
                )?,
            )
        }
        chat => (
            key.chat_handle(user_index_canister_id, context.app_id, app_canister_id, chat)?,
            key.message_handle(
                user_index_canister_id,
                context.app_id,
                app_canister_id,
                chat,
                context.thread_root_message_index,
                context.message_id,
            )?,
        ),
    };
    Ok(AppScopedCardContext {
        context_version: user_index_canister::c2c_redeem_ai_app_card_capability::APP_SCOPED_CARD_CONTEXT_VERSION_V1,
        app_subject: serde_bytes::ByteBuf::from(
            key.app_subject(user_index_canister_id, context.app_id, app_canister_id, context.user_id)?
                .to_vec(),
        ),
        chat_handle: serde_bytes::ByteBuf::from(chat_handle.to_vec()),
        message_handle: serde_bytes::ByteBuf::from(message_handle.to_vec()),
        app_id: context.app_id,
        app_revision: context.app_revision,
        action_id: context.action_id.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use crate::model::user::User;
    use candid::Principal;
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use types::{
        AiActionCardTemplate, AiActionDefinition, AiAppCardContext, AiAppManifest, AiAppSurface, Chat, MessageId,
        SurfaceDisplay, UserId,
    };
    use utils::env::test::TestEnv;

    fn user(value: u8) -> UserId {
        Principal::from_slice(&[value]).into()
    }

    #[test]
    fn invalid_token_spam_cannot_block_an_exact_valid_capability() {
        let caller = Principal::from_slice(&[41]);
        let canister_id = Principal::from_slice(&[42]);
        let token = [0xA5; TOKEN_BYTES];
        let mut data = Data::default();
        let capability = Capability {
            context: direct_context(user(1), user(2)),
            content_hash: [7; 32],
            app_canister_id: caller,
            recipient_key_scheme: "opaque-v1".to_string(),
            recipient_public_key: serde_bytes::ByteBuf::from(vec![5; 48]),
            app_user_key_fingerprint: None,
            app_user_key_version: None,
            scope: types::AiAppCardCapabilityScope::PrivateContext,
            expires_at: 100,
        };
        data.ai_app_card_tokens
            .insert_capability(canister_id, &token, capability.clone(), 1)
            .unwrap();

        for _ in 0..10 {
            data.ai_app_call_throttle.record_failure(AiAppCallKind::CardRedeem, caller, 2);
        }

        // A random miss is now rejected by the saturated invalid-attempt bucket.
        assert!(matches!(
            lookup_redemption_capability(&mut data, canister_id, &[0x5A; TOKEN_BYTES], caller, 3),
            Err(InvalidRequest(message)) if message.starts_with("too many failed redemption attempts")
        ));

        // The exact valid token is still looked up and admitted, then remains consume-once.
        assert!(matches!(
            lookup_redemption_capability(&mut data, canister_id, &token, caller, 3),
            Ok(found) if found == capability
        ));
        assert!(data.ai_app_card_tokens.consume_capability(canister_id, &token));
        assert!(matches!(
            lookup_redemption_capability(&mut data, canister_id, &token, caller, 3),
            Err(InvalidRequest(message)) if message.starts_with("too many failed redemption attempts")
        ));
    }

    #[test]
    fn saturated_wrong_key_attempts_cannot_block_full_exact_redemption() {
        let app_canister = Principal::from_slice(&[41]);
        let viewer = user(1);
        let peer = user(2);
        let app_owner = user(3);
        let token = [0xC3; TOKEN_BYTES];
        let env = TestEnv {
            caller: app_canister,
            ..Default::default()
        };
        let now = env.now;
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: viewer.as_principal(),
            user_id: viewer,
            username: "capability-viewer".to_string(),
            ..Default::default()
        });
        data.ai_app_scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(113))
            .unwrap();
        let app = data
            .ai_apps
            .register(
                app_owner,
                AiAppManifest {
                    name: "redemption-test".to_string(),
                    description: String::new(),
                    icon_url: None,
                    app_canister_id: Some(app_canister),
                    inbox_canister_id: Some(Principal::from_slice(&[9])),
                    consumer_public_key: "delivery-key".to_string(),
                    per_user_keys: false,
                    actions: vec![AiActionDefinition {
                        name: "generic.action".to_string(),
                        description: String::new(),
                        prompt_template: String::new(),
                        response_schema: "{}".to_string(),
                        card: AiActionCardTemplate {
                            title: String::new(),
                            confirm_label: String::new(),
                            cancel_label: String::new(),
                            rows: Vec::new(),
                            disclosure: None,
                        },
                        endpoint: String::new(),
                        consumer_public_key: None,
                        recipient_scope: None,
                        rules: Vec::new(),
                        accepts_image: false,
                    }],
                    surfaces: vec![AiAppSurface {
                        kind: "card".to_string(),
                        url: "https://app.example/card".to_string(),
                        display: SurfaceDisplay::Sheet,
                    }],
                },
                1,
                false,
            )
            .unwrap();
        assert!(data.ai_apps.publish(app.id, 2));
        let revision = data.ai_apps.get(app.id).unwrap().updated;
        let mut pair = [viewer, peer];
        pair.sort_unstable();
        let capability = Capability {
            context: AiAppCardContext {
                user_id: viewer,
                chat: Chat::Direct(peer.into()),
                chat_key: format!("direct:{}:{}", pair[0], pair[1]),
                thread_root_message_index: None,
                message_id: MessageId::from(7u64),
                app_id: app.id,
                app_revision: revision,
                action_id: "generic.action".to_string(),
            },
            content_hash: [7; 32],
            app_canister_id: app_canister,
            recipient_key_scheme: "opaque-v1".to_string(),
            recipient_public_key: serde_bytes::ByteBuf::from(vec![5; 48]),
            app_user_key_fingerprint: None,
            app_user_key_version: None,
            scope: types::AiAppCardCapabilityScope::PrivateContext,
            expires_at: now.saturating_add(100),
        };
        let mut state = RuntimeState::new(Box::new(env), data);
        state
            .data
            .ai_app_card_tokens
            .insert_capability(state.env.canister_id(), &token, capability, now)
            .unwrap();
        for _ in 0..10 {
            state
                .data
                .ai_app_call_throttle
                .record_failure(AiAppCallKind::CardRedeem, app_canister, now);
        }

        let wrong_key = Args {
            token: token.to_vec().into(),
            recipient_key_scheme: "opaque-v1".to_string(),
            recipient_public_key: vec![9; 48].into(),
        };
        assert!(matches!(
            redeem_impl(wrong_key, &mut state),
            InvalidRequest(message) if message.starts_with("too many failed redemption attempts")
        ));
        assert!(matches!(
            state
                .data
                .ai_app_card_tokens
                .lookup_capability(state.env.canister_id(), &token, now),
            LookupCapabilityResult::Valid(_)
        ));

        let correct = Args {
            token: token.to_vec().into(),
            recipient_key_scheme: "opaque-v1".to_string(),
            recipient_public_key: vec![5; 48].into(),
        };
        assert!(matches!(redeem_impl(correct, &mut state), Success(_)));
        let replay = Args {
            token: token.to_vec().into(),
            recipient_key_scheme: "opaque-v1".to_string(),
            recipient_public_key: vec![5; 48].into(),
        };
        assert!(matches!(
            redeem_impl(replay, &mut state),
            InvalidRequest(message) if message.starts_with("too many failed redemption attempts")
        ));
    }

    #[test]
    fn capability_user_existence_gate_fails_closed_for_a_deleted_account() {
        let user_id = user(9);
        let mut data = Data::default();
        assert!(!capability_user_exists(&data, user_id));
        data.users.add_test_user(User {
            principal: user_id.as_principal(),
            user_id,
            username: "live-capability-user".to_string(),
            ..Default::default()
        });
        assert!(capability_user_exists(&data, user_id));
        assert!(data.users.delete_user(user_id, 1).is_some());
        assert!(!capability_user_exists(&data, user_id));
    }

    fn direct_context(viewer: UserId, other: UserId) -> AiAppCardContext {
        let mut pair = [viewer, other];
        pair.sort_unstable();
        AiAppCardContext {
            user_id: viewer,
            chat: Chat::Direct(other.into()),
            chat_key: format!("direct:{}:{}", pair[0], pair[1]),
            thread_root_message_index: Some(3u32.into()),
            message_id: MessageId::from(7u64),
            app_id: 11,
            app_revision: 13,
            action_id: "generic.action".to_string(),
        }
    }

    #[test]
    fn key_mode_and_exact_fingerprint_are_both_required() {
        let fingerprint = [7; 32];
        assert!(app_user_key_binding_matches(
            true,
            Some(fingerprint),
            Some(7),
            Some(fingerprint),
            Some(7)
        ));
        assert!(!app_user_key_binding_matches(
            true,
            Some(fingerprint),
            Some(7),
            Some([8; 32]),
            Some(7)
        ));
        assert!(!app_user_key_binding_matches(true, Some(fingerprint), Some(7), None, Some(7)));
        assert!(!app_user_key_binding_matches(
            true,
            Some(fingerprint),
            None,
            Some(fingerprint),
            Some(7)
        ));
        assert!(!app_user_key_binding_matches(true, None, Some(7), Some(fingerprint), Some(7)));
        assert!(app_user_key_binding_matches(false, None, None, None, None));
        assert!(!app_user_key_binding_matches(false, Some(fingerprint), Some(7), None, None));
    }

    #[test]
    fn readding_the_same_key_does_not_revive_a_pre_revocation_capability() {
        let fingerprint = [7; 32];

        assert!(!app_user_key_binding_matches(
            true,
            Some(fingerprint),
            Some(7),
            Some(fingerprint),
            Some(8)
        ));
    }

    #[test]
    fn direct_app_scoped_chat_and_message_handles_are_symmetric() {
        let alice = user(1);
        let bob = user(2);
        let user_index = Principal::from_slice(&[3]);
        let app_canister = Principal::from_slice(&[4]);
        let mut key = crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey::default();
        key.ensure_initialized(&mut StdRng::seed_from_u64(91)).unwrap();

        let alice_view = app_scoped_context(&direct_context(alice, bob), app_canister, &key, user_index).unwrap();
        let bob_view = app_scoped_context(&direct_context(bob, alice), app_canister, &key, user_index).unwrap();

        assert_ne!(
            alice_view.app_subject, bob_view.app_subject,
            "the app subject remains user-specific"
        );
        assert_eq!(
            alice_view.chat_handle, bob_view.chat_handle,
            "the exact sorted participant pair must produce one opaque chat handle"
        );
        assert_eq!(
            alice_view.message_handle, bob_view.message_handle,
            "both stored perspectives of one direct message must produce one opaque message handle"
        );
    }

    #[test]
    fn direct_app_scoped_context_rejects_a_self_chat() {
        let alice = user(1);
        let mut key = crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey::default();
        key.ensure_initialized(&mut StdRng::seed_from_u64(92)).unwrap();

        assert!(
            app_scoped_context(
                &direct_context(alice, alice),
                Principal::from_slice(&[4]),
                &key,
                Principal::from_slice(&[3]),
            )
            .is_err()
        );
    }
}
