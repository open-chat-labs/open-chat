use crate::guards::caller_is_local_user_index_canister;
use crate::model::ai_app_chat_link_tokens::{AiAppChatLinkToken, InsertError, TOKEN_BYTES};
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use constants::MINUTE_IN_MS;
use group_index_canister::ai_app_chat_link_authority::AiAppChatLinkAuthorityBindingV1;
use rand::Rng;
use serde_bytes::ByteBuf;
use types::{Chat, Milliseconds};
use user_index_canister::c2c_create_ai_app_chat_link_token::{Response::*, *};

const TOKEN_TTL: Milliseconds = 10 * MINUTE_IN_MS;
const MAX_TOKEN_GENERATION_ATTEMPTS: usize = 10;
const TOKEN_ENTROPY_PURPOSE: &[u8] = b"user-index/chat-link-token/v1";

// A successful response contains a live URL bearer and therefore must never be traced.
#[update(guard = "caller_is_local_user_index_canister", msgpack = true)]
async fn c2c_create_ai_app_chat_link_token(args: Args) -> Response {
    if !read_state(crate::pr2_entropy::is_ready) {
        return Error("AI-app chat-link service temporarily unavailable".to_string());
    }
    if !types::is_valid_ai_app_chat_name(&args.chat_name) {
        return InvalidRequest("chat_name is missing or invalid".to_string());
    }
    let caller = ic_cdk::api::msg_caller();
    let Some(admitted_account_lifecycle_epoch) = read_state(|state| state.data.users.account_lifecycle_epoch(&args.user_id))
    else {
        return NotAuthorized;
    };
    // Reject locally saturated subjects before consuming one-time GroupIndex authority. The
    // insertion path repeats this check after the await, so concurrent requests remain bounded.
    if let Err(error) = mutate_state(|state| {
        let now = state.env.now();
        state
            .data
            .ai_app_chat_link_tokens
            .check_admission(args.user_id, args.app_id, now)
    }) {
        return insert_error_response(error);
    }
    match args.chat {
        Chat::Direct(_) if !args.authority.is_empty() => {
            return InvalidRequest("direct chat token must not carry group route authority".to_string());
        }
        Chat::Direct(_) if !read_state(|state| direct_route_is_current(&args, caller, state)) => {
            return NotAuthorized;
        }
        Chat::Group(_) | Chat::Channel(_, _) => {
            let binding = authority_binding(&args, caller);
            if crate::ai_app_chat_link_authority::consume(binding, &args.authority)
                .await
                .is_err()
            {
                return NotAuthorized;
            }
        }
        Chat::Direct(_) => {}
    }
    mutate_state(|state| create_impl(args, caller, admitted_account_lifecycle_epoch, state))
}

fn create_impl(
    args: Args,
    issuer_local_user_index_canister_id: types::CanisterId,
    admitted_account_lifecycle_epoch: u64,
    state: &mut RuntimeState,
) -> Response {
    if state.data.users.account_lifecycle_epoch(&args.user_id) != Some(admitted_account_lifecycle_epoch) {
        return AppUnavailable;
    }
    let Some(app) = state.data.ai_apps.get(args.app_id) else {
        return AppUnavailable;
    };
    if !app.published
        || !app.manifest.per_user_keys
        || app.updated != args.app_revision
        || app.manifest.app_canister_id.is_none()
    {
        return AppUnavailable;
    }
    let app_canister_id = app.manifest.app_canister_id.unwrap();
    if matches!(args.chat, Chat::Direct(other) if types::UserId::from(other) == args.user_id) {
        return InvalidRequest("direct chat participants must be distinct".to_string());
    }
    let Some(key) = state
        .data
        .ai_app_user_keys
        .keys_for_users(args.app_id, &[args.user_id])
        .ok()
        .and_then(|keys| keys.into_iter().next())
    else {
        return AppUnavailable;
    };
    let Some(app_user_key_version) = state.data.ai_app_user_keys.binding_version(args.user_id, args.app_id) else {
        return AppUnavailable;
    };
    let app_user_key_fingerprint = sha256::sha256(key.public_key.as_bytes());
    let this_canister_id = state.env.canister_id();
    let app_subject =
        match state
            .data
            .ai_app_scoped_identity_key
            .app_subject(this_canister_id, args.app_id, app_canister_id, args.user_id)
        {
            Ok(value) => value,
            Err(_) => return AppUnavailable,
        };
    let chat_handle = match args.chat {
        Chat::Direct(other) => state.data.ai_app_scoped_identity_key.direct_chat_handle(
            this_canister_id,
            args.app_id,
            app_canister_id,
            args.user_id,
            other.into(),
        ),
        chat => state
            .data
            .ai_app_scoped_identity_key
            .chat_handle(this_canister_id, args.app_id, app_canister_id, chat),
    };
    let chat_handle = match chat_handle {
        Ok(value) => value,
        Err(_) => return InvalidRequest("invalid chat identity".to_string()),
    };
    let now = state.env.now();
    let expires_at = now.saturating_add(TOKEN_TTL);
    let mut rng = match crate::pr2_entropy::output_rng(state, TOKEN_ENTROPY_PURPOSE) {
        Ok(rng) => rng,
        Err(_) => return Error("AI-app chat-link service temporarily unavailable".to_string()),
    };
    for _ in 0..MAX_TOKEN_GENERATION_ATTEMPTS {
        let mut raw = [0u8; TOKEN_BYTES];
        rng.fill_bytes(&mut raw);
        let entry = AiAppChatLinkToken {
            user_id: args.user_id,
            chat: args.chat,
            chat_name: args.chat_name.clone(),
            app_id: args.app_id,
            app_revision: args.app_revision,
            app_canister_id,
            issuer_local_user_index_canister_id,
            app_user_key_fingerprint,
            app_user_key_version,
            app_subject,
            chat_handle,
            expires_at,
        };
        match state.data.ai_app_chat_link_tokens.insert(this_canister_id, &raw, entry, now) {
            Ok(()) => {
                return Success(SuccessResult {
                    token: ByteBuf::from(raw.to_vec()),
                    expires_at,
                });
            }
            Err(InsertError::TokenCollision) => continue,
            Err(error) => return insert_error_response(error),
        }
    }
    Error("can't generate a unique chat-link token".to_string())
}

fn insert_error_response(error: InsertError) -> Response {
    match error {
        InsertError::RateLimited => Error("chat-link token issuance rate limit reached".to_string()),
        InsertError::UserCapacity | InsertError::AppCapacity | InsertError::GlobalCapacity => {
            Error("too many outstanding chat-link tokens".to_string())
        }
        InsertError::TokenCollision => Error("can't generate a unique chat-link token".to_string()),
    }
}

pub(crate) fn authority_binding(
    args: &Args,
    local_user_index_canister_id: types::CanisterId,
) -> AiAppChatLinkAuthorityBindingV1 {
    AiAppChatLinkAuthorityBindingV1 {
        local_user_index_canister_id,
        user_id: args.user_id,
        chat: args.chat,
        app_id: args.app_id,
        app_revision: args.app_revision,
    }
}

fn direct_route_is_current(args: &Args, caller: candid::Principal, state: &RuntimeState) -> bool {
    matches!(args.chat, Chat::Direct(_)) && state.data.local_index_map.get_index_canister(&args.user_id) == Some(caller)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use crate::model::user::User;
    use p256_key_pair::P256KeyPair;
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use types::{AiAppManifest, UserId};
    use utils::env::test::TestEnv;

    fn manifest(app_canister_id: types::CanisterId) -> AiAppManifest {
        AiAppManifest {
            name: "chat-link-app".to_string(),
            description: String::new(),
            icon_url: None,
            app_canister_id: Some(app_canister_id),
            inbox_canister_id: None,
            consumer_public_key: String::new(),
            per_user_keys: true,
            actions: Vec::new(),
            surfaces: Vec::new(),
        }
    }

    #[test]
    fn mint_requires_exact_published_revision_and_current_user_key() {
        let env = TestEnv::default();
        let user_id: UserId = env.caller.into();
        let now = env.now;
        let app_canister = candid::Principal::from_slice(&[8]);
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            user_id,
            username: "chat-link-viewer".to_string(),
            date_created: 10,
            ..Default::default()
        });
        data.ai_app_scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(44))
            .unwrap();
        let app = data.ai_apps.register(user_id, manifest(app_canister), now, true).unwrap();
        assert!(data.ai_apps.publish(app.id, now));
        let mut state = RuntimeState::new(Box::new(env), data);
        let args = Args {
            user_id,
            chat: Chat::Group(candid::Principal::from_slice(&[20]).into()),
            chat_name: "Household".to_string(),
            app_id: app.id,
            app_revision: app.updated,
            authority: ByteBuf::new(),
        };

        let issuer = candid::Principal::from_slice(&[30]);
        assert!(matches!(create_impl(args, issuer, 0, &mut state), AppUnavailable));
        let key = P256KeyPair::new(&mut StdRng::seed_from_u64(45)).public_key_pem().to_string();
        state.data.ai_app_user_keys.set(user_id, app.id, key).unwrap();
        let stale = Args {
            user_id,
            chat: Chat::Group(candid::Principal::from_slice(&[20]).into()),
            chat_name: "Household".to_string(),
            app_id: app.id,
            app_revision: app.updated.saturating_add(1),
            authority: ByteBuf::new(),
        };
        assert!(matches!(create_impl(stale, issuer, 0, &mut state), AppUnavailable));
        let exact = Args {
            user_id,
            chat: Chat::Group(candid::Principal::from_slice(&[20]).into()),
            chat_name: "Household".to_string(),
            app_id: app.id,
            app_revision: app.updated,
            authority: ByteBuf::new(),
        };
        assert!(matches!(create_impl(exact, issuer, 0, &mut state), Success(_)));
    }

    #[test]
    fn group_chat_link_does_not_mint_for_a_recreated_account_after_authority_await() {
        let env = TestEnv::default();
        let viewer: UserId = env.caller.into();
        let app_owner: UserId = candid::Principal::from_slice(&[70]).into();
        let app_canister = candid::Principal::from_slice(&[71]);
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            user_id: viewer,
            username: "incumbent-chat-link-viewer".to_string(),
            date_created: 10,
            ..Default::default()
        });
        data.ai_app_scoped_identity_key
            .ensure_initialized(&mut StdRng::seed_from_u64(46))
            .unwrap();
        let app = data.ai_apps.register(app_owner, manifest(app_canister), 10, true).unwrap();
        assert!(data.ai_apps.publish(app.id, 11));
        let key = P256KeyPair::new(&mut StdRng::seed_from_u64(47)).public_key_pem().to_string();
        data.ai_app_user_keys.set(viewer, app.id, key.clone()).unwrap();
        let args = Args {
            user_id: viewer,
            chat: Chat::Group(candid::Principal::from_slice(&[72]).into()),
            chat_name: "Household".to_string(),
            app_id: app.id,
            app_revision: data.ai_apps.get(app.id).unwrap().updated,
            authority: ByteBuf::new(),
        };
        let mut state = RuntimeState::new(Box::new(env), data);

        assert!(state.data.users.delete_user(viewer, 20).is_some());
        state.delete_ai_app_user_state(viewer, 20);
        state.data.users.add_test_user(User {
            principal: viewer.as_principal(),
            user_id: viewer,
            username: "recreated-chat-link-viewer".to_string(),
            date_created: 30,
            ..Default::default()
        });
        state.data.ai_app_user_keys.set(viewer, app.id, key).unwrap();

        assert!(matches!(
            create_impl(args, candid::Principal::from_slice(&[73]), 0, &mut state),
            AppUnavailable
        ));
    }

    #[test]
    fn direct_mint_requires_the_viewers_current_home_lui() {
        let viewer = UserId::from(candid::Principal::from_slice(&[21]));
        let home_lui = candid::Principal::from_slice(&[22]);
        let other_lui = candid::Principal::from_slice(&[23]);
        let mut data = Data::default();
        data.local_index_map.add_index(home_lui, types::BuildVersion::default());
        data.local_index_map.add_index(other_lui, types::BuildVersion::default());
        data.local_index_map.add_user(home_lui, viewer);
        let mut state = RuntimeState::new(Box::new(TestEnv::default()), data);
        let args = Args {
            user_id: viewer,
            chat: Chat::Direct(candid::Principal::from_slice(&[24]).into()),
            chat_name: "Manager".to_string(),
            app_id: 1,
            app_revision: 2,
            authority: ByteBuf::new(),
        };
        assert!(direct_route_is_current(&args, home_lui, &state));
        assert!(!direct_route_is_current(&args, other_lui, &state));

        assert!(state.data.local_index_map.remove_user(&viewer));
        assert!(state.data.local_index_map.add_user(other_lui, viewer));
        assert!(
            !direct_route_is_current(&args, home_lui, &state),
            "a stale former home LUI must lose authority immediately"
        );
        assert!(
            direct_route_is_current(&args, other_lui, &state),
            "only the newly current home LUI may authorize the direct route"
        );
    }
}
