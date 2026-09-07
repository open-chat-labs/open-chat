use crate::guards::caller_is_local_user_index_canister;
use crate::model::ai_app_card_tokens::{
    Capability, InsertError, MAX_RECIPIENT_PUBLIC_KEY_BYTES, MIN_RECIPIENT_PUBLIC_KEY_BYTES, TOKEN_BYTES,
};
use crate::updates::create_ai_app_card_provenance::{
    canonical_card_chat_key, resolve_current_card_app, validate_direct_card_lui_route,
};
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use constants::MINUTE_IN_MS;
use rand::Rng;
use serde_bytes::ByteBuf;
use user_index_canister::c2c_create_ai_app_card_capability::{Response::*, *};

const CAPABILITY_TTL: types::Milliseconds = 2 * MINUTE_IN_MS;
const MAX_TOKEN_GENERATION_ATTEMPTS: usize = 10;
const CAPABILITY_ENTROPY_PURPOSE: &[u8] = b"user-index/card-capability/v1";

// Successful responses contain a live bearer, so do not trace this method.
#[update(guard = "caller_is_local_user_index_canister", msgpack = true)]
async fn c2c_create_ai_app_card_capability(args: Args) -> Response {
    if !read_state(crate::pr2_entropy::is_ready) {
        return Error("AI-app card capability service temporarily unavailable".to_string());
    }
    let caller = ic_cdk::api::msg_caller();
    let Some(admitted_account_lifecycle_epoch) =
        read_state(|state| state.data.users.account_lifecycle_epoch(&args.context.user_id))
    else {
        return AppUnavailable;
    };
    if matches!(args.context.chat, types::Chat::Direct(_)) {
        if let Err(error) = read_state(|state| validate_direct_card_lui_route(&args.context, &args.authority, caller, state)) {
            return InvalidRequest(error);
        }
    } else {
        let binding = group_index_canister::ai_app_card_authority::AiAppCardAuthorityBindingV1 {
            local_user_index_canister_id: caller,
            context: args.context.clone(),
            content_hash: args.content_hash,
            operation:
                group_index_canister::ai_app_card_authority::AiAppCardAuthorityOperationV1::CreatePrivateContextCapability {
                    recipient_key_scheme: args.recipient_key_scheme.clone(),
                    recipient_public_key_hash: group_index_canister::ai_app_card_authority::opaque_hash_v1(
                        group_index_canister::ai_app_card_authority::OpaqueHashPurposeV1::RecipientPublicKey,
                        &args.recipient_public_key,
                    ),
                },
        };
        if crate::ai_app_card_authority::consume(binding, &args.authority).await.is_err() {
            return InvalidRequest("invalid or replayed card authority".to_string());
        }
    }
    mutate_state(|state| {
        if matches!(args.context.chat, types::Chat::Direct(_))
            && let Err(error) = validate_direct_card_lui_route(&args.context, &args.authority, caller, state)
        {
            return InvalidRequest(error);
        }
        c2c_create_ai_app_card_capability_impl(args, admitted_account_lifecycle_epoch, state)
    })
}

fn c2c_create_ai_app_card_capability_impl(
    args: Args,
    admitted_account_lifecycle_epoch: u64,
    state: &mut RuntimeState,
) -> Response {
    if state.data.users.account_lifecycle_epoch(&args.context.user_id) != Some(admitted_account_lifecycle_epoch) {
        return AppUnavailable;
    }
    if matches!(args.context.chat, types::Chat::Direct(_)) && !args.authority.is_empty() {
        return InvalidRequest("direct chat must not carry group route authority".to_string());
    }
    if !valid_recipient_key_scheme(&args.recipient_key_scheme) {
        return InvalidRequest("invalid recipient key scheme".to_string());
    }
    if args.recipient_public_key.len() < MIN_RECIPIENT_PUBLIC_KEY_BYTES
        || args.recipient_public_key.len() > MAX_RECIPIENT_PUBLIC_KEY_BYTES
    {
        return InvalidRequest(format!(
            "recipient public key must contain {MIN_RECIPIENT_PUBLIC_KEY_BYTES}..={MAX_RECIPIENT_PUBLIC_KEY_BYTES} bytes"
        ));
    }
    let chat_key = match canonical_card_chat_key(args.context.user_id, args.context.chat) {
        Ok(value) => value,
        Err(error) => return InvalidRequest(error),
    };
    if chat_key != args.context.chat_key {
        return InvalidRequest("non-canonical chat key".to_string());
    }
    let Some(app) = resolve_current_card_app(
        &state.data.ai_apps,
        args.context.app_id,
        args.context.app_revision,
        &args.context.action_id,
    ) else {
        return AppUnavailable;
    };
    if matches!(args.context.chat, types::Chat::Direct(_)) && !app.manifest.per_user_keys {
        return AppUnavailable;
    }
    let app_canister_id = app.manifest.app_canister_id.unwrap();
    let now = state.env.now();
    let (app_user_key_fingerprint, app_user_key_version) = if app.manifest.per_user_keys {
        let Some(key) = state
            .data
            .ai_app_user_keys
            .keys_for_users(args.context.app_id, &[args.context.user_id])
            .ok()
            .and_then(|keys| keys.into_iter().next())
        else {
            return AppUnavailable;
        };
        let Some(version) = state
            .data
            .ai_app_user_keys
            .binding_version(args.context.user_id, args.context.app_id)
        else {
            return AppUnavailable;
        };
        let Some(inbox_canister_id) = app.manifest.inbox_canister_id else {
            return AppUnavailable;
        };
        let fingerprint = match state.data.ai_app_scoped_identity_key.consumer_queue_selector(
            state.env.canister_id(),
            args.context.app_id,
            app_canister_id,
            inbox_canister_id,
            &key.public_key,
        ) {
            Ok(fingerprint) => fingerprint,
            Err(_) => return AppUnavailable,
        };
        (Some(fingerprint), Some(version))
    } else {
        (None, None)
    };
    let external_context = match crate::updates::c2c_redeem_ai_app_card_capability::app_scoped_context(
        &args.context,
        app_canister_id,
        &state.data.ai_app_scoped_identity_key,
        state.env.canister_id(),
    ) {
        Ok(context) => context,
        Err(_) => return AppUnavailable,
    };

    let expires_at = now + CAPABILITY_TTL;
    let mut rng = match crate::pr2_entropy::output_rng(state, CAPABILITY_ENTROPY_PURPOSE) {
        Ok(rng) => rng,
        Err(_) => return Error("AI-app card capability service temporarily unavailable".to_string()),
    };
    for _ in 0..MAX_TOKEN_GENERATION_ATTEMPTS {
        let mut raw = [0u8; TOKEN_BYTES];
        rng.fill_bytes(&mut raw);
        let capability = Capability {
            context: args.context.clone(),
            content_hash: args.content_hash,
            app_canister_id,
            recipient_key_scheme: args.recipient_key_scheme.clone(),
            recipient_public_key: args.recipient_public_key.clone(),
            app_user_key_fingerprint,
            app_user_key_version,
            scope: types::AiAppCardCapabilityScope::PrivateContext,
            expires_at,
        };
        match state
            .data
            .ai_app_card_tokens
            .insert_capability(state.env.canister_id(), &raw, capability, now)
        {
            Ok(()) => {
                return Success(SuccessResult {
                    token: ByteBuf::from(raw.to_vec()),
                    expires_at,
                    context: external_context.clone(),
                });
            }
            Err(InsertError::TokenCollision) => continue,
            Err(
                InsertError::UserLimitReached
                | InsertError::AppLimitReached
                | InsertError::StoreFull
                | InsertError::IssuanceRateLimitReached,
            ) => {
                return Error("too many outstanding AI-app card capabilities".to_string());
            }
        }
    }
    Error("can't generate AI-app card capability".to_string())
}

pub(crate) fn valid_recipient_key_scheme(value: &str) -> bool {
    let bytes = value.as_bytes();
    (1..=64).contains(&bytes.len())
        && (bytes[0].is_ascii_lowercase() || bytes[0].is_ascii_digit())
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'.' | b'_' | b'-'))
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
        AiActionCardTemplate, AiActionDefinition, AiAppCardContext, AiAppManifest, AiAppSurface, Chat, MessageId,
        SurfaceDisplay, UserId,
    };
    use utils::env::test::TestEnv;

    fn direct_fixture(authority: ByteBuf) -> (RuntimeState, Args) {
        let env = TestEnv::default();
        let owner: UserId = env.caller.into();
        let mut data = crate::Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            user_id: owner,
            username: "direct-capability-viewer".to_string(),
            date_created: 10,
            ..Default::default()
        });
        data.ai_app_scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(111))
            .unwrap();
        let manifest = AiAppManifest {
            name: "direct-capability".to_string(),
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
        let key = P256KeyPair::new(&mut StdRng::seed_from_u64(112)).public_key_pem().to_string();
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
            recipient_key_scheme: "opaque-v1".to_string(),
            recipient_public_key: ByteBuf::from(vec![4; 48]),
            authority,
        };
        (RuntimeState::new(Box::new(env), data), args)
    }

    #[test]
    fn direct_capability_accepts_current_per_user_app_without_group_authority() {
        let (mut state, args) = direct_fixture(ByteBuf::new());
        assert!(matches!(
            c2c_create_ai_app_card_capability_impl(args, 0, &mut state),
            Success(_)
        ));
    }

    #[test]
    fn direct_capability_rejects_nonempty_groupindex_authority() {
        let (mut state, args) = direct_fixture(ByteBuf::from(vec![
            7;
            group_index_canister::ai_app_card_authority::AI_APP_CARD_AUTHORITY_TOKEN_BYTES
        ]));
        assert!(matches!(
            c2c_create_ai_app_card_capability_impl(args, 0, &mut state),
            InvalidRequest(message) if message == "direct chat must not carry group route authority"
        ));
    }

    #[test]
    fn group_capability_does_not_mint_for_a_recreated_account_after_authority_await() {
        let env = TestEnv::default();
        let viewer: UserId = env.caller.into();
        let app_owner: UserId = Principal::from_slice(&[77]).into();
        let mut data = crate::Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            user_id: viewer,
            username: "incumbent-viewer".to_string(),
            date_created: 10,
            ..Default::default()
        });
        data.ai_app_scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(113))
            .unwrap();
        let manifest = AiAppManifest {
            name: "group-capability".to_string(),
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
        let context = AiAppCardContext {
            user_id: viewer,
            chat: Chat::Group(Principal::from_slice(&[55]).into()),
            chat_key: format!("group:{}", Principal::from_slice(&[55])),
            thread_root_message_index: None,
            message_id: MessageId::from(1u64),
            app_id: app.id,
            app_revision: data.ai_apps.get(app.id).unwrap().updated,
            action_id: "generic.action".to_string(),
        };
        let args = Args {
            context,
            content_hash: [3; 32],
            recipient_key_scheme: "opaque-v1".to_string(),
            recipient_public_key: ByteBuf::from(vec![4; 48]),
            authority: ByteBuf::new(),
        };
        let mut state = RuntimeState::new(Box::new(env), data);

        assert!(state.data.users.delete_user(viewer, 20).is_some());
        state.delete_ai_app_user_state(viewer, 20);
        state.data.users.add_test_user(User {
            principal: viewer.as_principal(),
            user_id: viewer,
            username: "recreated-viewer".to_string(),
            date_created: 30,
            ..Default::default()
        });

        assert!(matches!(
            c2c_create_ai_app_card_capability_impl(args, 0, &mut state),
            AppUnavailable
        ));
    }
}
