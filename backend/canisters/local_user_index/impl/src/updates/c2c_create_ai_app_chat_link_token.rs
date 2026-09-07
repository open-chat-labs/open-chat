use crate::guards::caller_is_local_child_canister;
use crate::read_state;
use crate::updates::c2c_create_ai_app_card_capability::{AuthoritativeChildKind, authoritative_child_registration};
use canister_api_macros::update;
use local_user_index_canister::c2c_create_ai_app_chat_link_token::{Response::*, *};
use types::Chat;

#[update(guard = "caller_is_local_child_canister", msgpack = true)]
async fn c2c_create_ai_app_chat_link_token(args: Args) -> Response {
    let caller = ic_cdk::api::msg_caller();
    let initial_registration = read_state(|state| authoritative_child_registration(state, caller));
    if let Err(error) = validate_child_context(&args, caller, initial_registration.kind) {
        return InvalidRequest(error);
    }
    let user_index_canister_id = read_state(|state| state.data.user_index_canister_id);
    let result = user_index_canister_c2c_client::c2c_create_ai_app_chat_link_token(
        user_index_canister_id,
        &user_index_canister::c2c_create_ai_app_chat_link_token::Args {
            user_id: args.user_id,
            chat: args.chat,
            chat_name: args.chat_name.clone(),
            app_id: args.app_id,
            app_revision: args.app_revision,
            authority: args.authority.clone(),
        },
    )
    .await;
    let current_registration = read_state(|state| authoritative_child_registration(state, caller));
    if current_registration != initial_registration {
        cleanup_success(user_index_canister_id, &args, &result).await;
        return InvalidRequest("local child registration changed while chat-link token was minted".to_string());
    }
    if let Err(error) = validate_child_context(&args, caller, current_registration.kind) {
        cleanup_success(user_index_canister_id, &args, &result).await;
        return InvalidRequest(error);
    }
    match result {
        Ok(user_index_canister::c2c_create_ai_app_chat_link_token::Response::Success(result)) => Success(SuccessResult {
            token: result.token,
            expires_at: result.expires_at,
        }),
        Ok(user_index_canister::c2c_create_ai_app_chat_link_token::Response::AppUnavailable) => AppUnavailable,
        Ok(user_index_canister::c2c_create_ai_app_chat_link_token::Response::NotAuthorized) => NotAuthorized,
        Ok(user_index_canister::c2c_create_ai_app_chat_link_token::Response::InvalidRequest(error)) => InvalidRequest(error),
        Ok(user_index_canister::c2c_create_ai_app_chat_link_token::Response::Error(error)) => Error(error),
        Err(_) => Error("AI-app chat-link service unavailable".to_string()),
    }
}

async fn cleanup_success(
    user_index_canister_id: types::CanisterId,
    args: &Args,
    result: &Result<user_index_canister::c2c_create_ai_app_chat_link_token::Response, types::C2CError>,
) {
    let Ok(user_index_canister::c2c_create_ai_app_chat_link_token::Response::Success(success)) = result else {
        return;
    };
    let _ = user_index_canister_c2c_client::c2c_cancel_ai_app_chat_link_token(
        user_index_canister_id,
        &user_index_canister::c2c_cancel_ai_app_chat_link_token::Args {
            user_id: args.user_id,
            chat: args.chat,
            app_id: args.app_id,
            app_revision: args.app_revision,
            token: success.token.clone(),
        },
    )
    .await;
}

fn validate_child_context(args: &Args, caller: candid::Principal, kind: AuthoritativeChildKind) -> Result<(), String> {
    if !types::is_valid_ai_app_chat_name(&args.chat_name) {
        return Err("chat_name is missing or invalid".to_string());
    }
    if !args.member_user_ids.contains(&args.user_id) {
        return Err("authoritative member list does not contain the viewer".to_string());
    }
    match args.chat {
        Chat::Group(chat_id) if kind != AuthoritativeChildKind::Group || candid::Principal::from(chat_id) != caller => {
            Err("caller is not the asserted local group canister".to_string())
        }
        Chat::Channel(community_id, _)
            if kind != AuthoritativeChildKind::Community || candid::Principal::from(community_id) != caller =>
        {
            Err("caller is not the asserted local community canister".to_string())
        }
        Chat::Direct(other) => {
            if kind != AuthoritativeChildKind::User || args.user_id.canister_id() != caller {
                return Err("caller is not the viewer's exact local user canister".to_string());
            }
            let other_user_id: types::UserId = other.into();
            if other_user_id == args.user_id
                || args.member_user_ids.len() != 2
                || !args.member_user_ids.contains(&other_user_id)
            {
                return Err("direct chat must contain the canonical distinct participant pair".to_string());
            }
            if !args.authority.is_empty() {
                return Err("direct chat must not carry group route authority".to_string());
            }
            Ok(())
        }
        Chat::Group(_) | Chat::Channel(_, _) => {
            if args.member_user_ids.len() != 1 {
                return Err("group chat-link mint must assert only the authenticated viewer".to_string());
            }
            if args.authority.is_empty() {
                return Err("group chat-link mint requires dedicated route authority".to_string());
            }
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_bytes::ByteBuf;

    #[test]
    fn indexed_direct_chat_link_keeps_the_pair_and_checks_the_hosting_child() {
        let host = candid::Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 42, 1, 1]);
        let viewer = types::UserId::new_indexed(host, 1);
        let peer = types::UserId::new_indexed(host, 2);
        let mut args = Args {
            user_id: viewer,
            chat: Chat::Direct(peer.into()),
            chat_name: "Chat".to_string(),
            app_id: 1,
            app_revision: 2,
            member_user_ids: vec![viewer, peer],
            authority: ByteBuf::new(),
        };
        assert!(validate_child_context(&args, host, AuthoritativeChildKind::User).is_ok());
        assert!(validate_child_context(&args, viewer.as_principal(), AuthoritativeChildKind::User).is_err());
        assert!(validate_child_context(&args, host, AuthoritativeChildKind::Group).is_err());
        args.member_user_ids = vec![types::UserId::new_indexed(host, 3), peer];
        assert!(validate_child_context(&args, host, AuthoritativeChildKind::User).is_err());
    }

    #[test]
    fn direct_requires_the_exact_user_child_and_canonical_pair() {
        let caller = candid::Principal::from_slice(&[7]);
        let viewer: types::UserId = caller.into();
        let other: types::UserId = candid::Principal::from_slice(&[8]).into();
        let args = Args {
            user_id: viewer,
            chat: Chat::Direct(other.into()),
            chat_name: "Manager".to_string(),
            app_id: 1,
            app_revision: 2,
            member_user_ids: vec![viewer, other],
            authority: ByteBuf::new(),
        };
        assert!(validate_child_context(&args, caller, AuthoritativeChildKind::User).is_ok());
        assert!(validate_child_context(&args, candid::Principal::from_slice(&[9]), AuthoritativeChildKind::User).is_err());
        let mut forged = args;
        forged.member_user_ids = vec![viewer];
        assert!(validate_child_context(&forged, caller, AuthoritativeChildKind::User).is_err());
    }

    #[test]
    fn groups_require_exact_child_kind_and_nonempty_route_authority() {
        let group = candid::Principal::from_slice(&[7]);
        let viewer: types::UserId = candid::Principal::from_slice(&[8]).into();
        let mut args = Args {
            user_id: viewer,
            chat: Chat::Group(group.into()),
            chat_name: "Household".to_string(),
            app_id: 1,
            app_revision: 2,
            member_user_ids: vec![viewer],
            authority: ByteBuf::new(),
        };
        assert!(validate_child_context(&args, group, AuthoritativeChildKind::Group).is_err());
        args.authority = ByteBuf::from(vec![3; types::AI_APP_CARD_TOKEN_BYTES]);
        assert!(validate_child_context(&args, group, AuthoritativeChildKind::Group).is_ok());
        assert!(validate_child_context(&args, group, AuthoritativeChildKind::Community).is_err());
    }
}
