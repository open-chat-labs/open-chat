use crate::guards::caller_is_local_user_index_canister;
use crate::updates::create_ai_app_card_provenance::{resolve_current_card_app, validate_direct_card_lui_route};
use crate::{mutate_state, read_state};
use ai_app_verifier_canister::c2c_authorize_ai_action_recipients as authorize_recipients;
use canister_api_macros::update;
use group_index_canister::ai_app_card_authority::{AiAppCardAuthorityBindingV1, AiAppCardAuthorityOperationV1};
use user_index_canister::c2c_ai_app_confirmed_action_route::{Response::*, *};

#[update(guard = "caller_is_local_user_index_canister", msgpack = true)]
async fn c2c_ai_app_confirmed_action_route(args: Args) -> Response {
    if args.confirmation_lease_generation == 0 {
        return InvalidRequest("invalid confirmation lease generation".to_string());
    }
    let caller = ic_cdk::api::msg_caller();
    let binding = AiAppCardAuthorityBindingV1 {
        local_user_index_canister_id: caller,
        context: args.context.clone(),
        content_hash: args.content_hash,
        operation: AiAppCardAuthorityOperationV1::DepositConfirmedAction {
            confirm_payload_hash: args.confirm_payload_hash,
            confirmation_lease_generation: args.confirmation_lease_generation,
            created_at: args.created_at,
        },
    };
    let validated = if matches!(args.context.chat, types::Chat::Direct(_)) {
        if read_state(|state| validate_direct_card_lui_route(&args.context, &args.authority, caller, state)).is_err() {
            return InvalidAuthority;
        }
        binding
    } else {
        match crate::ai_app_card_authority::validate(binding.clone(), &args.authority).await {
            Ok(binding) if binding == validated_binding(&args, binding.local_user_index_canister_id) => binding,
            _ => return InvalidAuthority,
        }
    };
    // Capture a fresh grant clock only after the chat/group authority await. It is deliberately
    // distinct from the immutable confirmation timestamp so an exact delayed retry can obtain a
    // fresh bounded authorization without changing the card/delivery identity.
    let authorization_created_at = read_state(|state| state.env.now());
    #[expect(
        clippy::result_large_err,
        reason = "Return the existing public route failure variants without changing the response representation"
    )]
    let callback = match read_state(|state| {
        if matches!(args.context.chat, types::Chat::Direct(_))
            && validate_direct_card_lui_route(&args.context, &args.authority, caller, state).is_err()
        {
            return Err(InvalidAuthority);
        }
        recipient_authorization_callback(
            &validated,
            &state.data.ai_apps,
            &state.data.ai_app_scoped_identity_key,
            state.env.canister_id(),
            authorization_created_at,
        )
        .map_err(|_| AppUnavailable)
    }) {
        Ok(callback) => callback,
        Err(response) => return response,
    };
    let authorization = if let Some((app_canister_id, callback_args)) = callback {
        let quota_principal = validated.context.user_id.as_principal();
        if mutate_state(|state| {
            state.data.ai_app_call_throttle.admit_recipient_route(
                quota_principal,
                validated.context.app_id,
                authorization_created_at,
            )
        })
        .is_err()
        {
            return AppUnavailable;
        }
        let callback_result =
            ai_app_verifier_canister_c2c_client::c2c_authorize_ai_action_recipients(app_canister_id, &callback_args).await;
        mutate_state(|state| {
            state.data.ai_app_call_throttle.finish_recipient_route(
                quota_principal,
                validated.context.app_id,
                authorization_created_at,
            );
        });
        match callback_result {
            Ok(authorize_recipients::Response::Success(result)) => Some(result),
            _ => return AppUnavailable,
        }
    } else {
        None
    };
    read_state(|state| {
        if matches!(args.context.chat, types::Chat::Direct(_))
            && validate_direct_card_lui_route(&args.context, &args.authority, caller, state).is_err()
        {
            return InvalidAuthority;
        }
        resolve_route_with_authorization(
            &validated,
            authorization.as_ref().map(|result| (result, authorization_created_at)),
            &state.data.ai_apps,
            &state.data.ai_app_user_keys,
            &state.data.ai_app_scoped_identity_key,
            state.env.canister_id(),
            state.env.now(),
        )
    })
}

fn validated_binding(args: &Args, local_user_index_canister_id: types::CanisterId) -> AiAppCardAuthorityBindingV1 {
    AiAppCardAuthorityBindingV1 {
        local_user_index_canister_id,
        context: args.context.clone(),
        content_hash: args.content_hash,
        operation: AiAppCardAuthorityOperationV1::DepositConfirmedAction {
            confirm_payload_hash: args.confirm_payload_hash,
            confirmation_lease_generation: args.confirmation_lease_generation,
            created_at: args.created_at,
        },
    }
}

/// Builds the exact app callback request without performing egress. The update entrypoint captures
/// `authorization_created_at` only after route authority has been validated, then uses this helper
/// to bind that fresh clock alongside the immutable confirmation timestamp.
pub(crate) fn recipient_authorization_callback(
    binding: &AiAppCardAuthorityBindingV1,
    registry: &crate::model::ai_app_registry::AiAppRegistry,
    scoped_identity_key: &crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey,
    user_index_canister_id: types::CanisterId,
    authorization_created_at: types::TimestampMillis,
) -> Result<Option<(types::CanisterId, authorize_recipients::Args)>, String> {
    let context = &binding.context;
    let app = resolve_current_card_app(registry, context.app_id, context.app_revision, &context.action_id)
        .ok_or_else(|| "producing app is unavailable or stale".to_string())?;
    let action = app
        .manifest
        .actions
        .iter()
        .find(|action| action.name == context.action_id)
        .expect("resolved app contains its action");
    if !matches!(action.recipient_scope, Some(types::AiActionRecipientScope::AppAuthorized)) {
        return Ok(None);
    }
    if !app.manifest.per_user_keys {
        return Err("app-authorized recipients require per-user delivery keys".to_string());
    }
    let app_canister_id = app
        .manifest
        .app_canister_id
        .ok_or_else(|| "producing app has no vouched app canister".to_string())?;
    let external_context = crate::updates::c2c_redeem_ai_app_card_capability::app_scoped_context(
        context,
        app_canister_id,
        scoped_identity_key,
        user_index_canister_id,
    )?;
    let AiAppCardAuthorityOperationV1::DepositConfirmedAction {
        confirm_payload_hash,
        confirmation_lease_generation,
        created_at,
    } = &binding.operation
    else {
        return Err("action authority has the wrong operation".to_string());
    };
    Ok(Some((
        app_canister_id,
        authorize_recipients::Args {
            context: external_context,
            content_hash: binding.content_hash,
            confirm_payload_hash: *confirm_payload_hash,
            confirmation_lease_generation: *confirmation_lease_generation,
            created_at: *created_at,
            authorization_created_at,
        },
    )))
}

#[cfg(test)]
fn resolve_route(
    binding: &AiAppCardAuthorityBindingV1,
    registry: &crate::model::ai_app_registry::AiAppRegistry,
    user_keys: &crate::model::ai_app_user_keys::AiAppUserKeys,
    scoped_identity_key: &crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey,
    user_index_canister_id: types::CanisterId,
) -> Response {
    resolve_route_with_authorization(
        binding,
        None,
        registry,
        user_keys,
        scoped_identity_key,
        user_index_canister_id,
        0,
    )
}

fn resolve_route_with_authorization(
    binding: &AiAppCardAuthorityBindingV1,
    authorization: Option<(&authorize_recipients::SuccessResult, types::TimestampMillis)>,
    registry: &crate::model::ai_app_registry::AiAppRegistry,
    user_keys: &crate::model::ai_app_user_keys::AiAppUserKeys,
    scoped_identity_key: &crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey,
    user_index_canister_id: types::CanisterId,
    now: types::TimestampMillis,
) -> Response {
    let context = &binding.context;
    let Some(app) = resolve_current_card_app(registry, context.app_id, context.app_revision, &context.action_id) else {
        return AppUnavailable;
    };
    if matches!(context.chat, types::Chat::Direct(_)) && !app.manifest.per_user_keys {
        return AppUnavailable;
    }
    let inbox_canister_id = app.manifest.inbox_canister_id.unwrap();
    let app_canister_id = app.manifest.app_canister_id.unwrap();
    let external_context = match crate::updates::c2c_redeem_ai_app_card_capability::app_scoped_context(
        context,
        app_canister_id,
        scoped_identity_key,
        user_index_canister_id,
    ) {
        Ok(context) => context,
        Err(_) => return AppUnavailable,
    };
    if app.manifest.per_user_keys {
        let action = app
            .manifest
            .actions
            .iter()
            .find(|action| action.name == context.action_id)
            .expect("resolved card app contains its action");
        let confirmer_key = user_keys
            .keys_for_users(context.app_id, &[context.user_id])
            .ok()
            .and_then(|mut keys| keys.pop());
        if confirmer_key.as_ref().is_none_or(|key| key.user_id != context.user_id) {
            return AppUnavailable;
        }
        let selector = match scoped_identity_key.consumer_queue_selector(
            user_index_canister_id,
            context.app_id,
            app_canister_id,
            inbox_canister_id,
            &confirmer_key.as_ref().unwrap().public_key,
        ) {
            Ok(selector) => selector,
            Err(_) => return AppUnavailable,
        };
        let (recipients, recipient_authorization) =
            if matches!(action.recipient_scope, Some(types::AiActionRecipientScope::AppAuthorized)) {
                let Some((authorization, authorization_created_at)) = authorization else {
                    return AppUnavailable;
                };
                match validate_app_authorized_recipients(
                    context.user_id,
                    authorization,
                    context.app_id,
                    app_canister_id,
                    inbox_canister_id,
                    user_keys,
                    scoped_identity_key,
                    user_index_canister_id,
                    authorization_created_at,
                    now,
                ) {
                    Ok((routes, grant)) => (routes, Some(grant)),
                    Err(_) => return AppUnavailable,
                }
            } else {
                if authorization.is_some() {
                    return AppUnavailable;
                }
                (Vec::new(), None)
            };
        Success(SuccessResult {
            inbox_canister_id,
            consumer_queue_selector: serde_bytes::ByteBuf::from(selector.to_vec()),
            consumer_queue_selector_version: 1,
            per_user_keys: true,
            consumer_public_key: None,
            confirmer_key,
            recipients,
            recipient_authorization,
            external_context,
        })
    } else {
        if authorization.is_some() {
            return AppUnavailable;
        }
        let action = app
            .manifest
            .actions
            .iter()
            .find(|action| action.name == context.action_id)
            .expect("resolved card app contains its action");
        let consumer_public_key = action
            .consumer_public_key
            .as_ref()
            .filter(|key| !key.is_empty())
            .or_else(|| (!app.manifest.consumer_public_key.is_empty()).then_some(&app.manifest.consumer_public_key))
            .cloned();
        if consumer_public_key.is_none() {
            return AppUnavailable;
        }
        let selector = match scoped_identity_key.consumer_queue_selector(
            user_index_canister_id,
            context.app_id,
            app_canister_id,
            inbox_canister_id,
            consumer_public_key.as_deref().unwrap(),
        ) {
            Ok(selector) => selector,
            Err(_) => return AppUnavailable,
        };
        Success(SuccessResult {
            inbox_canister_id,
            consumer_queue_selector: serde_bytes::ByteBuf::from(selector.to_vec()),
            consumer_queue_selector_version: 1,
            per_user_keys: false,
            consumer_public_key,
            confirmer_key: None,
            recipients: Vec::new(),
            recipient_authorization: None,
            external_context,
        })
    }
}

/// Converts an untrusted app callback into current UserIndex-owned recipient routes. No subject or
/// selector is looked up globally: each public key expands through the existing bounded reverse
/// index, then every candidate is recomputed under this exact app and current binding epoch.
#[allow(clippy::too_many_arguments)]
pub(crate) fn validate_app_authorized_recipients(
    confirmed_by: types::UserId,
    authorization: &authorize_recipients::SuccessResult,
    app_id: types::AiAppId,
    app_canister_id: types::CanisterId,
    inbox_canister_id: types::CanisterId,
    user_keys: &crate::model::ai_app_user_keys::AiAppUserKeys,
    scoped_identity_key: &crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey,
    user_index_canister_id: types::CanisterId,
    authorization_created_at: types::TimestampMillis,
    now: types::TimestampMillis,
) -> Result<(Vec<RecipientRoute>, RecipientAuthorizationGrant), String> {
    let expected_expires_at = authorization_created_at
        .checked_add(authorize_recipients::RECIPIENT_AUTHORIZATION_TTL_MILLIS)
        .ok_or_else(|| "recipient authorization expiry overflowed".to_string())?;
    if authorization.expires_at != expected_expires_at || now < authorization_created_at || now > authorization.expires_at {
        return Err("recipient authorization is outside its deterministic validity window".to_string());
    }
    if authorization.scope_commitment.len() != authorize_recipients::SCOPE_COMMITMENT_BYTES {
        return Err("recipient scope commitment has an invalid length".to_string());
    }
    if authorization.recipients.is_empty() || authorization.recipients.len() > authorize_recipients::MAX_AUTHORIZED_RECIPIENTS {
        return Err("app returned an invalid recipient count".to_string());
    }
    let mut routes = Vec::with_capacity(authorization.recipients.len());
    let mut previous_subject: Option<&[u8]> = None;
    let mut resolved_users = std::collections::BTreeSet::new();
    for recipient in &authorization.recipients {
        if recipient.subject_version != authorize_recipients::APP_SUBJECT_VERSION_V1
            || recipient.consumer_queue_selector_version != authorize_recipients::CONSUMER_QUEUE_SELECTOR_VERSION_V1
            || recipient.app_subject.len() != 32
            || recipient.consumer_queue_selector.len() != 32
        {
            return Err("app returned an invalid recipient binding version or length".to_string());
        }
        if previous_subject.is_some_and(|previous| previous >= recipient.app_subject.as_ref()) {
            return Err("app recipients must be uniquely ordered by subject".to_string());
        }
        previous_subject = Some(recipient.app_subject.as_ref());
        let candidates = user_keys
            .bindings_for_public_key(&recipient.consumer_public_key)
            .map_err(|error| error.message())?;
        let mut matched_user = None;
        for (candidate_user, candidate_app) in candidates {
            if candidate_app != app_id {
                continue;
            }
            let subject = scoped_identity_key.app_subject(user_index_canister_id, app_id, app_canister_id, candidate_user)?;
            if subject.as_slice() != recipient.app_subject.as_ref() {
                continue;
            }
            let selector = scoped_identity_key.consumer_queue_selector(
                user_index_canister_id,
                app_id,
                app_canister_id,
                inbox_canister_id,
                &recipient.consumer_public_key,
            )?;
            if selector.as_slice() != recipient.consumer_queue_selector.as_ref()
                || user_keys.binding_version(candidate_user, app_id) != Some(recipient.app_user_key_version)
            {
                return Err("app returned a stale recipient key binding".to_string());
            }
            if matched_user.replace(candidate_user).is_some() {
                return Err("app recipient binding is ambiguous".to_string());
            }
        }
        let user_id = matched_user.ok_or_else(|| "app recipient is not currently linked".to_string())?;
        if !resolved_users.insert(user_id) {
            return Err("app returned the same recipient more than once".to_string());
        }
        routes.push(RecipientRoute {
            user_id,
            public_key: recipient.consumer_public_key.clone(),
            consumer_queue_selector: recipient.consumer_queue_selector.clone(),
            consumer_queue_selector_version: recipient.consumer_queue_selector_version,
            app_subject: recipient.app_subject.clone(),
            subject_version: recipient.subject_version,
            app_user_key_version: recipient.app_user_key_version,
        });
    }
    if !resolved_users.contains(&confirmed_by) {
        return Err("app-authorized recipients do not include the confirmer".to_string());
    }
    Ok((
        routes,
        RecipientAuthorizationGrant {
            scope_commitment: authorization.scope_commitment.clone(),
            authorization_created_at,
            expires_at: authorization.expires_at,
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::ai_app_registry::AiAppRegistry;
    use crate::model::ai_app_scoped_identity::AiAppScopedIdentityKey;
    use crate::model::ai_app_user_keys::AiAppUserKeys;
    use candid::Principal;
    use p256_key_pair::P256KeyPair;
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use serde_bytes::ByteBuf;
    use types::{
        AiActionCardTemplate, AiActionDefinition, AiAppManifest, AiAppSurface, Chat, MessageId, SurfaceDisplay, UserId,
    };

    fn user(value: u8) -> UserId {
        Principal::from_slice(&[value]).into()
    }

    fn valid_key(seed: u64) -> String {
        P256KeyPair::new(&mut StdRng::seed_from_u64(seed))
            .public_key_pem()
            .to_string()
    }

    fn scoped_identity_key() -> AiAppScopedIdentityKey {
        let mut key = AiAppScopedIdentityKey::default();
        key.ensure_initialized(&mut StdRng::seed_from_u64(58)).unwrap();
        key
    }

    #[expect(
        clippy::too_many_arguments,
        reason = "The fixture names every recipient binding component to make authorization cases explicit"
    )]
    fn authorized_recipient(
        user_id: UserId,
        public_key: String,
        app_id: u32,
        app_canister_id: Principal,
        inbox_canister_id: Principal,
        user_index_canister_id: Principal,
        keys: &AiAppUserKeys,
        scoped: &AiAppScopedIdentityKey,
    ) -> authorize_recipients::AuthorizedRecipient {
        authorize_recipients::AuthorizedRecipient {
            app_subject: ByteBuf::from(
                scoped
                    .app_subject(user_index_canister_id, app_id, app_canister_id, user_id)
                    .unwrap()
                    .to_vec(),
            ),
            subject_version: authorize_recipients::APP_SUBJECT_VERSION_V1,
            consumer_queue_selector: ByteBuf::from(
                scoped
                    .consumer_queue_selector(
                        user_index_canister_id,
                        app_id,
                        app_canister_id,
                        inbox_canister_id,
                        &public_key,
                    )
                    .unwrap()
                    .to_vec(),
            ),
            consumer_queue_selector_version: authorize_recipients::CONSUMER_QUEUE_SELECTOR_VERSION_V1,
            consumer_public_key: public_key,
            app_user_key_version: keys.binding_version(user_id, app_id).unwrap(),
        }
    }

    fn authorization_at(
        mut recipients: Vec<authorize_recipients::AuthorizedRecipient>,
        authorization_created_at: u64,
    ) -> authorize_recipients::SuccessResult {
        recipients.sort_unstable_by(|left, right| left.app_subject.as_ref().cmp(right.app_subject.as_ref()));
        authorize_recipients::SuccessResult {
            recipients,
            scope_commitment: ByteBuf::from(vec![7; authorize_recipients::SCOPE_COMMITMENT_BYTES]),
            expires_at: authorization_created_at + authorize_recipients::RECIPIENT_AUTHORIZATION_TTL_MILLIS,
        }
    }

    fn authorization(recipients: Vec<authorize_recipients::AuthorizedRecipient>) -> authorize_recipients::SuccessResult {
        authorization_at(recipients, 100)
    }

    fn resolve_for_test(
        binding: &AiAppCardAuthorityBindingV1,
        registry: &AiAppRegistry,
        user_keys: &AiAppUserKeys,
    ) -> Response {
        resolve_route(
            binding,
            registry,
            user_keys,
            &scoped_identity_key(),
            Principal::from_slice(&[5]),
        )
    }

    fn manifest(per_user_keys: bool, app_key: &str, action_key: Option<&str>) -> AiAppManifest {
        AiAppManifest {
            name: "generic-card-app".to_string(),
            description: String::new(),
            icon_url: None,
            app_canister_id: Some(Principal::from_slice(&[8])),
            inbox_canister_id: Some(Principal::from_slice(&[9])),
            consumer_public_key: app_key.to_string(),
            per_user_keys,
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
                consumer_public_key: action_key.map(str::to_string),
                recipient_scope: None,
                rules: Vec::new(),
                accepts_image: false,
            }],
            surfaces: vec![AiAppSurface {
                kind: "card".to_string(),
                url: "https://app.example/card".to_string(),
                display: SurfaceDisplay::Sheet,
            }],
        }
    }

    fn published_app(registry: &mut AiAppRegistry, manifest: AiAppManifest) -> (u32, u64) {
        let app = registry.register(user(1), manifest, 10, false).unwrap();
        assert!(registry.publish(app.id, 11));
        (app.id, registry.get(app.id).unwrap().updated)
    }

    fn binding(user_id: UserId, app_id: u32, app_revision: u64) -> AiAppCardAuthorityBindingV1 {
        let group = Principal::from_slice(&[7]);
        AiAppCardAuthorityBindingV1 {
            local_user_index_canister_id: Principal::from_slice(&[6]),
            context: types::AiAppCardContext {
                user_id,
                chat: Chat::Group(group.into()),
                chat_key: format!("group:{group}"),
                thread_root_message_index: None,
                message_id: MessageId::from(1u64),
                app_id,
                app_revision,
                action_id: "generic.action".to_string(),
            },
            content_hash: [3; 32],
            operation: AiAppCardAuthorityOperationV1::DepositConfirmedAction {
                confirm_payload_hash: [4; 32],
                confirmation_lease_generation: 5,
                created_at: 6,
            },
        }
    }

    fn direct_binding(user_id: UserId, peer: UserId, app_id: u32, app_revision: u64) -> AiAppCardAuthorityBindingV1 {
        let mut binding = binding(user_id, app_id, app_revision);
        let mut pair = [user_id, peer];
        pair.sort_unstable();
        binding.context.chat = Chat::Direct(peer.into());
        binding.context.chat_key = format!("direct:{}:{}", pair[0], pair[1]);
        binding
    }

    #[test]
    fn app_level_route_uses_the_exact_current_action_key() {
        let mut registry = AiAppRegistry::default();
        let action_key = valid_key(10);
        let (app_id, revision) = published_app(&mut registry, manifest(false, "", Some(&action_key)));
        let response = resolve_for_test(&binding(user(2), app_id, revision), &registry, &AiAppUserKeys::default());
        match response {
            Success(result) => {
                assert!(!result.per_user_keys);
                assert_eq!(result.consumer_public_key.as_deref(), Some(action_key.as_str()));
                assert_eq!(result.consumer_queue_selector.len(), 32);
                assert_eq!(result.consumer_queue_selector_version, 1);
                assert!(result.confirmer_key.is_none());
                assert_eq!(result.external_context.context_version, 1);
                assert_eq!(result.external_context.app_id, app_id);
                assert_eq!(result.external_context.app_revision, revision);
                assert_eq!(result.external_context.action_id, "generic.action");
                assert_eq!(result.external_context.app_subject.len(), 32);
                assert_eq!(result.external_context.chat_handle.len(), 32);
                assert_eq!(result.external_context.message_handle.len(), 32);
            }
            _ => panic!("a complete current app-level route should resolve"),
        }

        assert!(matches!(
            resolve_for_test(
                &binding(user(2), app_id, revision.saturating_add(1)),
                &registry,
                &AiAppUserKeys::default()
            ),
            AppUnavailable
        ));
    }

    #[test]
    fn per_user_route_returns_only_the_exact_confirmers_key() {
        let mut registry = AiAppRegistry::default();
        let (app_id, revision) = published_app(&mut registry, manifest(true, "", None));
        let confirmer = user(2);
        let other = user(3);
        let confirmer_public_key = valid_key(1);
        let other_public_key = valid_key(2);
        let mut user_keys = AiAppUserKeys::default();
        user_keys.set(confirmer, app_id, confirmer_public_key.clone()).unwrap();
        user_keys.set(other, app_id, other_public_key).unwrap();

        match resolve_for_test(&binding(confirmer, app_id, revision), &registry, &user_keys) {
            Success(result) => {
                assert!(result.per_user_keys);
                assert!(result.consumer_public_key.is_none());
                let key = result.confirmer_key.expect("the confirmer has an exact app key");
                assert_eq!(key.user_id, confirmer);
                assert_eq!(key.public_key, confirmer_public_key);
                assert_eq!(result.consumer_queue_selector.len(), 32);
                assert_eq!(result.consumer_queue_selector_version, 1);
                assert_eq!(result.external_context.app_subject.len(), 32);
            }
            _ => panic!("the exact confirmer key should resolve"),
        }

        assert!(matches!(
            resolve_for_test(&binding(user(4), app_id, revision), &registry, &user_keys),
            AppUnavailable
        ));
    }

    #[test]
    fn direct_route_requires_the_exact_confirmers_current_per_user_key() {
        let confirmer = user(2);
        let peer = user(3);

        let mut per_user_registry = AiAppRegistry::default();
        let (app_id, revision) = published_app(&mut per_user_registry, manifest(true, "", None));
        let mut user_keys = AiAppUserKeys::default();
        user_keys.set(confirmer, app_id, valid_key(31)).unwrap();
        assert!(matches!(
            resolve_for_test(
                &direct_binding(confirmer, peer, app_id, revision),
                &per_user_registry,
                &user_keys,
            ),
            Success(_)
        ));
        assert!(matches!(
            resolve_for_test(
                &direct_binding(user(4), peer, app_id, revision),
                &per_user_registry,
                &user_keys,
            ),
            AppUnavailable
        ));

        let mut shared_registry = AiAppRegistry::default();
        let (shared_id, shared_revision) = published_app(&mut shared_registry, manifest(false, &valid_key(32), None));
        assert!(matches!(
            resolve_for_test(
                &direct_binding(confirmer, peer, shared_id, shared_revision),
                &shared_registry,
                &AiAppUserKeys::default(),
            ),
            AppUnavailable
        ));
    }

    #[test]
    fn legacy_route_success_msgpack_defaults_to_confirmer_only() {
        #[derive(serde::Serialize)]
        struct LegacySuccessResult {
            inbox_canister_id: types::CanisterId,
            consumer_queue_selector: ByteBuf,
            consumer_queue_selector_version: u16,
            per_user_keys: bool,
            consumer_public_key: Option<String>,
            confirmer_key: Option<types::AiAppMemberKey>,
            external_context: user_index_canister::c2c_redeem_ai_app_card_capability::AppScopedCardContext,
        }

        let encoded = msgpack::serialize_to_vec(&LegacySuccessResult {
            inbox_canister_id: Principal::from_slice(&[7]),
            consumer_queue_selector: ByteBuf::from(vec![8; 32]),
            consumer_queue_selector_version: 1,
            per_user_keys: true,
            consumer_public_key: None,
            confirmer_key: None,
            external_context: user_index_canister::c2c_redeem_ai_app_card_capability::AppScopedCardContext {
                context_version: 1,
                app_subject: ByteBuf::from(vec![1; 32]),
                chat_handle: ByteBuf::from(vec![2; 32]),
                message_handle: ByteBuf::from(vec![3; 32]),
                app_id: 4,
                app_revision: 5,
                action_id: "legacy.action".to_string(),
            },
        })
        .unwrap();
        let decoded: SuccessResult = msgpack::deserialize(encoded.as_slice()).unwrap();
        assert!(decoded.recipients.is_empty());
        assert!(decoded.recipient_authorization.is_none());
    }

    #[test]
    fn callback_request_keeps_confirmation_time_and_fresh_authorization_time_separate() {
        let mut registry = AiAppRegistry::default();
        let mut app_manifest = manifest(true, "", None);
        app_manifest.actions[0].recipient_scope = Some(types::AiActionRecipientScope::AppAuthorized);
        let (app_id, revision) = published_app(&mut registry, app_manifest);
        let authority = binding(user(2), app_id, revision);
        let scoped = scoped_identity_key();
        let user_index = Principal::from_slice(&[5]);
        let (app_canister, callback) = recipient_authorization_callback(&authority, &registry, &scoped, user_index, 900_000)
            .unwrap()
            .unwrap();
        assert_eq!(app_canister, Principal::from_slice(&[8]));
        assert_eq!(callback.created_at, 6);
        assert_eq!(callback.authorization_created_at, 900_000);
        assert_eq!(callback.content_hash, [3; 32]);
        assert_eq!(callback.confirm_payload_hash, [4; 32]);
        assert_eq!(callback.confirmation_lease_generation, 5);
        assert_eq!(callback.context.app_id, app_id);
        assert_eq!(callback.context.app_revision, revision);
        assert_eq!(callback.context.action_id, "generic.action");

        let mut default_registry = AiAppRegistry::default();
        let (default_id, default_revision) = published_app(&mut default_registry, manifest(true, "", None));
        assert!(
            recipient_authorization_callback(
                &binding(user(2), default_id, default_revision),
                &default_registry,
                &scoped,
                user_index,
                900_000,
            )
            .unwrap()
            .is_none()
        );
    }

    #[test]
    fn deposit_binding_commits_every_route_authority_field() {
        let original = Args {
            context: binding(user(2), 11, 12).context,
            content_hash: [3; 32],
            confirm_payload_hash: [4; 32],
            confirmation_lease_generation: 5,
            created_at: 6,
            authority: ByteBuf::from(vec![7; 32]),
        };
        let owner = Principal::from_slice(&[6]);
        let expected = validated_binding(&original, owner);

        let mut changed = original;
        changed.content_hash[0] ^= 1;
        assert_ne!(validated_binding(&changed, owner), expected);
        changed.content_hash[0] ^= 1;
        changed.confirm_payload_hash[0] ^= 1;
        assert_ne!(validated_binding(&changed, owner), expected);
        changed.confirm_payload_hash[0] ^= 1;
        changed.confirmation_lease_generation += 1;
        assert_ne!(validated_binding(&changed, owner), expected);
        changed.confirmation_lease_generation -= 1;
        changed.created_at += 1;
        assert_ne!(validated_binding(&changed, owner), expected);
        changed.created_at -= 1;
        changed.context.action_id.push_str(".forged");
        assert_ne!(validated_binding(&changed, owner), expected);
    }

    #[test]
    fn app_authorized_recipient_validation_selects_only_exact_returned_current_bindings() {
        let app_id = 7;
        let app_canister = Principal::from_slice(&[8]);
        let inbox = Principal::from_slice(&[9]);
        let user_index = Principal::from_slice(&[5]);
        let confirmer = user(2);
        let partner = user(3);
        let unrelated = user(4);
        let mut keys = AiAppUserKeys::default();
        let confirmer_key = valid_key(71);
        let partner_key = valid_key(72);
        keys.set(confirmer, app_id, confirmer_key.clone()).unwrap();
        keys.set(partner, app_id, partner_key.clone()).unwrap();
        keys.set(unrelated, app_id, valid_key(73)).unwrap();
        let scoped = scoped_identity_key();
        let grant = authorization(vec![
            authorized_recipient(
                confirmer,
                confirmer_key,
                app_id,
                app_canister,
                inbox,
                user_index,
                &keys,
                &scoped,
            ),
            authorized_recipient(partner, partner_key, app_id, app_canister, inbox, user_index, &keys, &scoped),
        ]);
        let (routes, accepted_grant) = validate_app_authorized_recipients(
            confirmer,
            &grant,
            app_id,
            app_canister,
            inbox,
            &keys,
            &scoped,
            user_index,
            100,
            100,
        )
        .unwrap();
        assert_eq!(routes.len(), 2);
        assert!(routes.iter().any(|route| route.user_id == confirmer));
        assert!(routes.iter().any(|route| route.user_id == partner));
        assert!(!routes.iter().any(|route| route.user_id == unrelated));
        assert_eq!(accepted_grant.scope_commitment, grant.scope_commitment);
        assert_eq!(accepted_grant.authorization_created_at, 100);
    }

    #[test]
    fn app_authorized_recipient_validation_rejects_duplicate_stale_and_missing_confirmer_claims() {
        let app_id = 7;
        let app_canister = Principal::from_slice(&[8]);
        let inbox = Principal::from_slice(&[9]);
        let user_index = Principal::from_slice(&[5]);
        let confirmer = user(2);
        let partner = user(3);
        let mut keys = AiAppUserKeys::default();
        let confirmer_key = valid_key(81);
        let partner_key = valid_key(82);
        keys.set(confirmer, app_id, confirmer_key.clone()).unwrap();
        keys.set(partner, app_id, partner_key.clone()).unwrap();
        let scoped = scoped_identity_key();
        let confirmer_recipient = authorized_recipient(
            confirmer,
            confirmer_key,
            app_id,
            app_canister,
            inbox,
            user_index,
            &keys,
            &scoped,
        );
        let partner_recipient =
            authorized_recipient(partner, partner_key, app_id, app_canister, inbox, user_index, &keys, &scoped);
        let validate = |grant: &authorize_recipients::SuccessResult, keys: &AiAppUserKeys| {
            validate_app_authorized_recipients(
                confirmer,
                grant,
                app_id,
                app_canister,
                inbox,
                keys,
                &scoped,
                user_index,
                100,
                100,
            )
        };

        assert!(validate(&authorization(vec![partner_recipient.clone()]), &keys).is_err());
        assert!(
            validate(
                &authorization(vec![confirmer_recipient.clone(), confirmer_recipient.clone()]),
                &keys
            )
            .is_err()
        );

        let mut stale = authorization(vec![confirmer_recipient, partner_recipient]);
        stale.recipients[0].app_user_key_version += 1;
        assert!(validate(&stale, &keys).is_err());

        let mut rotated = keys;
        rotated.set(partner, app_id, valid_key(83)).unwrap();
        assert!(validate(&authorization(stale.recipients), &rotated).is_err());
    }

    #[test]
    fn old_confirmation_uses_a_fresh_authorization_clock_and_stale_authorization_is_rejected() {
        let app_id = 7;
        let app_canister = Principal::from_slice(&[8]);
        let inbox = Principal::from_slice(&[9]);
        let user_index = Principal::from_slice(&[5]);
        let confirmer = user(2);
        let mut keys = AiAppUserKeys::default();
        let public_key = valid_key(91);
        keys.set(confirmer, app_id, public_key.clone()).unwrap();
        let scoped = scoped_identity_key();
        let immutable_confirmation_created_at = 1;
        let fresh_authorization_created_at = 1_000_000;
        let callback_args = authorize_recipients::Args {
            context: user_index_canister::c2c_redeem_ai_app_card_capability::AppScopedCardContext {
                context_version: user_index_canister::c2c_redeem_ai_app_card_capability::APP_SCOPED_CARD_CONTEXT_VERSION_V1,
                app_subject: ByteBuf::from(vec![1; 32]),
                chat_handle: ByteBuf::from(vec![2; 32]),
                message_handle: ByteBuf::from(vec![3; 32]),
                app_id,
                app_revision: 11,
                action_id: "generic.action".to_string(),
            },
            content_hash: [3; 32],
            confirm_payload_hash: [4; 32],
            confirmation_lease_generation: 5,
            created_at: immutable_confirmation_created_at,
            authorization_created_at: fresh_authorization_created_at,
        };
        assert!(
            callback_args.created_at + authorize_recipients::RECIPIENT_AUTHORIZATION_TTL_MILLIS
                < callback_args.authorization_created_at,
            "the immutable confirmation is deliberately older than one authorization TTL"
        );
        let authorization = authorization_at(
            vec![authorized_recipient(
                confirmer,
                public_key,
                app_id,
                app_canister,
                inbox,
                user_index,
                &keys,
                &scoped,
            )],
            callback_args.authorization_created_at,
        );
        let accepted = validate_app_authorized_recipients(
            confirmer,
            &authorization,
            app_id,
            app_canister,
            inbox,
            &keys,
            &scoped,
            user_index,
            callback_args.authorization_created_at,
            callback_args.authorization_created_at,
        )
        .unwrap();
        assert_eq!(accepted.1.authorization_created_at, fresh_authorization_created_at);

        assert!(
            validate_app_authorized_recipients(
                confirmer,
                &authorization,
                app_id,
                app_canister,
                inbox,
                &keys,
                &scoped,
                user_index,
                callback_args.authorization_created_at,
                authorization.expires_at + 1,
            )
            .is_err()
        );

        let refreshed_authorization_created_at = authorization.expires_at + 1;
        let refreshed = authorization_at(authorization.recipients.clone(), refreshed_authorization_created_at);
        let refreshed_grant = validate_app_authorized_recipients(
            confirmer,
            &refreshed,
            app_id,
            app_canister,
            inbox,
            &keys,
            &scoped,
            user_index,
            refreshed_authorization_created_at,
            refreshed_authorization_created_at,
        )
        .unwrap()
        .1;
        assert_eq!(
            refreshed_grant.authorization_created_at, refreshed_authorization_created_at,
            "an unused expired route can obtain a fresh grant without changing confirmation time"
        );
    }
}
