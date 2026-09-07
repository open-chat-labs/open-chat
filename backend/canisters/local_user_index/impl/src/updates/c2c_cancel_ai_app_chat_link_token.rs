use crate::guards::caller_is_local_child_canister;
use crate::read_state;
use crate::updates::c2c_create_ai_app_card_capability::{AuthoritativeChildKind, authoritative_child_registration};
use canister_api_macros::update;
use local_user_index_canister::c2c_cancel_ai_app_chat_link_token::{Response::*, *};
use types::Chat;

// This exact-bearer endpoint must never be traced.
#[update(guard = "caller_is_local_child_canister", msgpack = true)]
async fn c2c_cancel_ai_app_chat_link_token(args: Args) -> Response {
    let caller = ic_cdk::api::msg_caller();
    let initial_registration = read_state(|state| authoritative_child_registration(state, caller));
    if let Err(error) = validate_child_context(&args, caller, initial_registration.kind) {
        return InvalidRequest(error);
    }
    let user_index_canister_id = read_state(|state| state.data.user_index_canister_id);
    let result = user_index_canister_c2c_client::c2c_cancel_ai_app_chat_link_token(
        user_index_canister_id,
        &user_index_canister::c2c_cancel_ai_app_chat_link_token::Args {
            user_id: args.user_id,
            chat: args.chat,
            app_id: args.app_id,
            app_revision: args.app_revision,
            token: args.token.clone(),
        },
    )
    .await;
    let current_registration = read_state(|state| authoritative_child_registration(state, caller));
    if current_registration != initial_registration || validate_child_context(&args, caller, current_registration.kind).is_err()
    {
        // The UI cancellation is exact and idempotent; if it already completed, returning a
        // failure here cannot revive the bearer.
        return InvalidRequest("local child registration changed during chat-link token cleanup".to_string());
    }
    match result {
        Ok(user_index_canister::c2c_cancel_ai_app_chat_link_token::Response::Success) => Success,
        Ok(user_index_canister::c2c_cancel_ai_app_chat_link_token::Response::InvalidRequest(error)) => InvalidRequest(error),
        Err(_) => Error("AI-app chat-link cleanup service unavailable".to_string()),
    }
}

fn validate_child_context(args: &Args, caller: candid::Principal, kind: AuthoritativeChildKind) -> Result<(), String> {
    match args.chat {
        Chat::Group(chat_id) if kind == AuthoritativeChildKind::Group && candid::Principal::from(chat_id) == caller => Ok(()),
        Chat::Channel(community_id, _)
            if kind == AuthoritativeChildKind::Community && candid::Principal::from(community_id) == caller =>
        {
            Ok(())
        }
        Chat::Direct(_) if kind == AuthoritativeChildKind::User && args.user_id.canister_id() == caller => Ok(()),
        _ => Err("caller is not the asserted local chat canister".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn indexed_user_cleanup_requires_the_hosting_user_child() {
        let host = candid::Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 42, 1, 1]);
        let viewer = types::UserId::new_indexed(host, 1);
        let peer = types::UserId::new_indexed(host, 2);
        let args = Args {
            user_id: viewer,
            chat: Chat::Direct(peer.into()),
            app_id: 1,
            app_revision: 2,
            token: vec![3; 32].into(),
        };
        assert!(validate_child_context(&args, host, AuthoritativeChildKind::User).is_ok());
        assert!(validate_child_context(&args, viewer.as_principal(), AuthoritativeChildKind::User).is_err());
        assert!(validate_child_context(&args, host, AuthoritativeChildKind::Group).is_err());
    }

    #[test]
    fn cleanup_requires_the_exact_authoritative_child_route() {
        let group = candid::Principal::from_slice(&[7]);
        let viewer: types::UserId = candid::Principal::from_slice(&[8]).into();
        let args = Args {
            user_id: viewer,
            chat: Chat::Group(group.into()),
            app_id: 1,
            app_revision: 2,
            token: vec![3; 32].into(),
        };
        assert!(validate_child_context(&args, group, AuthoritativeChildKind::Group).is_ok());
        assert!(validate_child_context(&args, group, AuthoritativeChildKind::Community).is_err());
        assert!(validate_child_context(&args, candid::Principal::from_slice(&[9]), AuthoritativeChildKind::Group).is_err());
    }
}
