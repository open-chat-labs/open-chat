use crate::guards::caller_is_local_user_index_canister;
use crate::model::ai_app_card_tokens::{ConfirmationGrant, InsertError, TOKEN_BYTES};
use crate::updates::create_ai_app_card_provenance::{
    canonical_card_chat_key, resolve_current_card_app, validate_direct_card_lui_route,
};
use crate::{RuntimeState, mutate_state, read_state};
use ai_app_verifier_canister::c2c_attest_ai_app_card_confirmation_v1::{self, CardConfirmationAttestationBindingV1};
use canister_api_macros::update;
use constants::MINUTE_IN_MS;
use rand::Rng;
use serde_bytes::ByteBuf;
use types::{AiAppCardContext, AiAppRegistration, Milliseconds, ai_app_card_confirm_payload_hash_v1};
use user_index_canister::c2c_create_ai_app_card_confirmation_grant::{Response::*, *};

const CONFIRMATION_GRANT_TTL: Milliseconds = 2 * MINUTE_IN_MS;
const MAX_TOKEN_GENERATION_ATTEMPTS: usize = 10;
const CONFIRMATION_GRANT_ENTROPY_PURPOSE: &[u8] = b"user-index/card-confirmation-grant/v1";

#[update(guard = "caller_is_local_user_index_canister", msgpack = true)]
async fn c2c_create_ai_app_card_confirmation_grant(args: Args) -> Response {
    if !read_state(crate::pr2_entropy::is_ready) {
        return Error("confirmation grant service temporarily unavailable".to_string());
    }
    let caller = ic_cdk::api::msg_caller();
    let Some(admitted_account_lifecycle_epoch) =
        read_state(|state| state.data.users.account_lifecycle_epoch(&args.context.user_id))
    else {
        return InvalidProvenance;
    };
    let authority_token = args.authority.clone();
    let authority_binding = if matches!(args.context.chat, types::Chat::Direct(_)) {
        if let Err(error) = read_state(|state| validate_direct_card_lui_route(&args.context, &authority_token, caller, state)) {
            return InvalidRequest(error);
        }
        None
    } else {
        Some(group_index_canister::ai_app_card_authority::AiAppCardAuthorityBindingV1 {
            local_user_index_canister_id: caller,
            context: args.context.clone(),
            content_hash: args.content_hash,
            operation: group_index_canister::ai_app_card_authority::AiAppCardAuthorityOperationV1::CreateConfirmationGrant {
                confirm_payload_hash: match ai_app_card_confirm_payload_hash_v1(&args.confirm_payload) {
                    Ok(hash) => hash,
                    Err(error) => return InvalidRequest(error),
                },
            },
        })
    };
    if let Some(binding) = &authority_binding
        && crate::ai_app_card_authority::validate(binding.clone(), &authority_token)
            .await
            .is_err()
    {
        return InvalidRequest("invalid or stale card authority".to_string());
    }
    let quota_principal = args.context.user_id.as_principal();
    let app_id = args.context.app_id;
    let (prepared, admitted_at) = match mutate_state(|state| {
        let now = state.env.now();
        state
            .data
            .ai_app_call_throttle
            .admit_card_attestation(quota_principal, app_id, now)
            .map_err(|retry_after_ms| Error(format!("confirmation attestation throttled; retry after {retry_after_ms}ms")))?;
        match prepare(args, admitted_account_lifecycle_epoch, state) {
            Ok(prepared) => Ok((prepared, now)),
            Err(response) => {
                state
                    .data
                    .ai_app_call_throttle
                    .finish_card_attestation(quota_principal, app_id, now);
                Err(response)
            }
        }
    }) {
        Ok(value) => value,
        Err(response) => return response,
    };

    let response = ai_app_verifier_canister_c2c_client::c2c_attest_ai_app_card_confirmation_v1(
        prepared.binding.app_canister_id,
        &c2c_attest_ai_app_card_confirmation_v1::Args {
            binding: prepared.binding.clone(),
        },
    )
    .await;
    if !read_state(crate::pr2_entropy::is_ready) {
        mutate_state(|state| {
            state
                .data
                .ai_app_call_throttle
                .finish_card_attestation(quota_principal, app_id, admitted_at)
        });
        return Error("confirmation grant service temporarily unavailable".to_string());
    }
    let authority_is_current = match authority_binding {
        Some(binding) => crate::ai_app_card_authority::consume(binding, &authority_token).await.is_ok(),
        None => read_state(|state| {
            validate_direct_card_lui_route(&prepared.authority_context, &authority_token, caller, state).is_ok()
        }),
    };
    mutate_state(|state| {
        state
            .data
            .ai_app_call_throttle
            .finish_card_attestation(quota_principal, app_id, admitted_at)
    });
    if !authority_is_current {
        return InvalidRequest("card authority changed during confirmation attestation".to_string());
    }
    let response = match response {
        Ok(response) => response,
        Err(_) => return Error("confirmation attestation unavailable".to_string()),
    };
    if !response.vouched || response.binding != prepared.binding {
        return AppUnavailable;
    }
    mutate_state(|state| mint(prepared, state))
}

#[derive(Clone)]
struct PreparedGrant {
    authority_context: AiAppCardContext,
    account_lifecycle_epoch: u64,
    binding: CardConfirmationAttestationBindingV1,
    app_user_key_fingerprint: Option<[u8; 32]>,
}

fn prepare(args: Args, admitted_account_lifecycle_epoch: u64, state: &RuntimeState) -> Result<PreparedGrant, Response> {
    if matches!(args.context.chat, types::Chat::Direct(_)) && !args.authority.is_empty() {
        return Err(InvalidRequest("direct chat must not carry group route authority".to_string()));
    }
    if args.confirm_payload.is_empty() || args.confirm_payload.len() > types::MAX_AI_APP_CONFIRM_PAYLOAD_BYTES {
        return Err(InvalidRequest(format!(
            "confirmation payload must contain 1..={} bytes",
            types::MAX_AI_APP_CONFIRM_PAYLOAD_BYTES
        )));
    }
    let canonical_chat_key = canonical_card_chat_key(args.context.user_id, args.context.chat).map_err(InvalidRequest)?;
    if canonical_chat_key != args.context.chat_key {
        return Err(InvalidRequest("non-canonical chat key".to_string()));
    }
    if state.data.users.account_lifecycle_epoch(&args.context.user_id) != Some(admitted_account_lifecycle_epoch) {
        return Err(InvalidProvenance);
    }
    let Some(app) = resolve_current_card_app(
        &state.data.ai_apps,
        args.context.app_id,
        args.context.app_revision,
        &args.context.action_id,
    ) else {
        return Err(AppUnavailable);
    };
    if matches!(args.context.chat, types::Chat::Direct(_)) && !app.manifest.per_user_keys {
        return Err(AppUnavailable);
    }
    let (app_user_key_fingerprint, app_user_key_version) = current_user_key_binding(state, app, &args.context)?;
    let app_canister_id = app.manifest.app_canister_id.unwrap();
    let external_context = crate::updates::c2c_redeem_ai_app_card_capability::app_scoped_context(
        &args.context,
        app_canister_id,
        &state.data.ai_app_scoped_identity_key,
        state.env.canister_id(),
    )
    .map_err(|_| AppUnavailable)?;
    Ok(PreparedGrant {
        authority_context: args.context,
        account_lifecycle_epoch: admitted_account_lifecycle_epoch,
        binding: CardConfirmationAttestationBindingV1 {
            user_index_canister_id: state.env.canister_id(),
            app_canister_id,
            context: external_context,
            content_hash: args.content_hash,
            confirm_payload: args.confirm_payload,
            app_user_key_version,
        },
        app_user_key_fingerprint,
    })
}

fn mint(prepared: PreparedGrant, state: &mut RuntimeState) -> Response {
    let context = &prepared.authority_context;
    let Some(app) = resolve_current_card_app(&state.data.ai_apps, context.app_id, context.app_revision, &context.action_id)
    else {
        return AppUnavailable;
    };
    if app.manifest.app_canister_id != Some(prepared.binding.app_canister_id)
        || state.data.users.account_lifecycle_epoch(&context.user_id) != Some(prepared.account_lifecycle_epoch)
    {
        return AppUnavailable;
    }
    let Ok(current_external_context) = crate::updates::c2c_redeem_ai_app_card_capability::app_scoped_context(
        context,
        prepared.binding.app_canister_id,
        &state.data.ai_app_scoped_identity_key,
        state.env.canister_id(),
    ) else {
        return AppUnavailable;
    };
    if current_external_context != prepared.binding.context {
        return AppUnavailable;
    }
    let Ok((current_fingerprint, current_version)) = current_user_key_binding(state, app, context) else {
        return AppUnavailable;
    };
    if current_fingerprint != prepared.app_user_key_fingerprint || current_version != prepared.binding.app_user_key_version {
        return AppUnavailable;
    }
    let payload_hash = match ai_app_card_confirm_payload_hash_v1(&prepared.binding.confirm_payload) {
        Ok(hash) => hash,
        Err(error) => return InvalidRequest(error),
    };
    let now = state.env.now();
    let expires_at = now + CONFIRMATION_GRANT_TTL;
    let mut rng = match crate::pr2_entropy::output_rng(state, CONFIRMATION_GRANT_ENTROPY_PURPOSE) {
        Ok(rng) => rng,
        Err(_) => return Error("confirmation grant service temporarily unavailable".to_string()),
    };
    for _ in 0..MAX_TOKEN_GENERATION_ATTEMPTS {
        let mut raw = [0u8; TOKEN_BYTES];
        rng.fill_bytes(&mut raw);
        let grant = ConfirmationGrant {
            context: prepared.authority_context.clone(),
            content_hash: prepared.binding.content_hash,
            confirm_payload_hash: payload_hash,
            app_canister_id: prepared.binding.app_canister_id,
            app_user_key_fingerprint: prepared.app_user_key_fingerprint,
            app_user_key_version: prepared.binding.app_user_key_version,
            expires_at,
        };
        match state
            .data
            .ai_app_card_tokens
            .insert_confirmation_grant(state.env.canister_id(), &raw, grant, now)
        {
            Ok(()) => {
                return Success(SuccessResult {
                    grant: ByteBuf::from(raw.to_vec()),
                    expires_at,
                });
            }
            Err(InsertError::TokenCollision) => continue,
            Err(_) => return Error("too many outstanding confirmation grants".to_string()),
        }
    }
    Error("could not generate confirmation grant".to_string())
}

pub(crate) fn current_user_key_binding(
    state: &RuntimeState,
    app: &AiAppRegistration,
    context: &AiAppCardContext,
) -> Result<(Option<[u8; 32]>, Option<u64>), Response> {
    if !app.manifest.per_user_keys {
        return Ok((None, None));
    }
    let key = state
        .data
        .ai_app_user_keys
        .keys_for_users(context.app_id, &[context.user_id])
        .ok()
        .and_then(|keys| keys.into_iter().next())
        .ok_or(AppUnavailable)?;
    let version = state
        .data
        .ai_app_user_keys
        .binding_version(context.user_id, context.app_id)
        .ok_or(AppUnavailable)?;
    let inbox_canister_id = app.manifest.inbox_canister_id.ok_or(AppUnavailable)?;
    let app_canister_id = app.manifest.app_canister_id.ok_or(AppUnavailable)?;
    let fingerprint = state
        .data
        .ai_app_scoped_identity_key
        .consumer_queue_selector(
            state.env.canister_id(),
            context.app_id,
            app_canister_id,
            inbox_canister_id,
            &key.public_key,
        )
        .map_err(|_| AppUnavailable)?;
    Ok((Some(fingerprint), Some(version)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::User;
    use candid::Principal;
    use p256_key_pair::P256KeyPair;
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use types::{
        AiActionCardTemplate, AiActionDefinition, AiAppManifest, AiAppSurface, Chat, MessageId, SurfaceDisplay, UserId,
    };
    use utils::env::test::TestEnv;

    fn direct_fixture(authority: ByteBuf) -> (RuntimeState, Args) {
        let env = TestEnv::default();
        let owner: UserId = env.caller.into();
        let mut data = crate::Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            user_id: owner,
            username: "direct-confirmer".to_string(),
            ..Default::default()
        });
        data.ai_app_scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(121))
            .unwrap();
        let manifest = AiAppManifest {
            name: "direct-grant".to_string(),
            description: String::new(),
            icon_url: None,
            app_canister_id: Some(Principal::from_slice(&[8])),
            inbox_canister_id: Some(Principal::from_slice(&[9])),
            consumer_public_key: String::new(),
            per_user_keys: true,
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
        };
        let app = data.ai_apps.register(owner, manifest, env.now, false).unwrap();
        assert!(data.ai_apps.publish(app.id, env.now));
        let revision = data.ai_apps.get(app.id).unwrap().updated;
        let key = P256KeyPair::new(&mut StdRng::seed_from_u64(122)).public_key_pem().to_string();
        data.ai_app_user_keys.set(owner, app.id, key).unwrap();
        let peer: UserId = Principal::from_slice(&[2]).into();
        let mut pair = [owner, peer];
        pair.sort_unstable();
        let args = Args {
            context: AiAppCardContext {
                user_id: owner,
                chat: Chat::Direct(peer.into()),
                chat_key: format!("direct:{}:{}", pair[0], pair[1]),
                thread_root_message_index: None,
                message_id: MessageId::from(1u64),
                app_id: app.id,
                app_revision: revision,
                action_id: "generic.action".to_string(),
            },
            content_hash: [3; 32],
            confirm_payload: ByteBuf::from(br#"{"account_type":"private"}"#.to_vec()),
            authority,
        };
        (RuntimeState::new(Box::new(env), data), args)
    }

    fn group_fixture_with_external_app_owner() -> (RuntimeState, Args, UserId, Principal) {
        let env = TestEnv::default();
        let principal = env.caller;
        let viewer: UserId = principal.into();
        let app_owner: UserId = Principal::from_slice(&[79]).into();
        let mut data = crate::Data::default();
        data.users.add_test_user(User {
            principal,
            user_id: viewer,
            username: "incumbent-group-confirmer".to_string(),
            date_created: 10,
            ..Default::default()
        });
        data.ai_app_scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(123))
            .unwrap();
        let manifest = AiAppManifest {
            name: "group-grant".to_string(),
            description: String::new(),
            icon_url: None,
            app_canister_id: Some(Principal::from_slice(&[8])),
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
        };
        let app = data.ai_apps.register(app_owner, manifest, 10, false).unwrap();
        assert!(data.ai_apps.publish(app.id, 11));
        let group = Principal::from_slice(&[78]);
        let args = Args {
            context: AiAppCardContext {
                user_id: viewer,
                chat: Chat::Group(group.into()),
                chat_key: format!("group:{group}"),
                thread_root_message_index: None,
                message_id: MessageId::from(1u64),
                app_id: app.id,
                app_revision: data.ai_apps.get(app.id).unwrap().updated,
                action_id: "generic.action".to_string(),
            },
            content_hash: [3; 32],
            confirm_payload: ByteBuf::from(br#"{"account_type":"private"}"#.to_vec()),
            authority: ByteBuf::new(),
        };
        (RuntimeState::new(Box::new(env), data), args, viewer, principal)
    }

    #[test]
    fn direct_confirmation_grant_accepts_current_per_user_app_without_group_authority() {
        let (state, args) = direct_fixture(ByteBuf::new());
        assert!(
            prepare(args, 0, &state).is_ok(),
            "an edited direct-card confirmation must be attestable for the confirmer's current app key"
        );
    }

    #[test]
    fn direct_confirmation_grant_rejects_nonempty_groupindex_authority() {
        let (state, args) = direct_fixture(ByteBuf::from(vec![
            7;
            group_index_canister::ai_app_card_authority::AI_APP_CARD_AUTHORITY_TOKEN_BYTES
        ]));
        assert!(matches!(
            prepare(args, 0, &state),
            Err(InvalidRequest(message)) if message == "direct chat must not carry group route authority"
        ));
    }

    #[test]
    fn attested_group_confirmation_does_not_mint_for_a_recreated_account() {
        let (mut state, args, viewer, principal) = group_fixture_with_external_app_owner();
        let prepared = prepare(args, 0, &state).unwrap();

        assert!(state.data.users.delete_user(viewer, 20).is_some());
        state.delete_ai_app_user_state(viewer, 20);
        state.data.users.add_test_user(User {
            principal,
            user_id: viewer,
            username: "recreated-group-confirmer".to_string(),
            date_created: 30,
            ..Default::default()
        });

        assert!(matches!(mint(prepared, &mut state), AppUnavailable));
    }
}
