use crate::guards::caller_is_group_or_community_canister;
use crate::model::ai_app_chat_link_authority::InsertError;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use constants::MINUTE_IN_MS;
use group_index_canister::ai_app_chat_link_authority::{
    AI_APP_CHAT_LINK_AUTHORITY_TOKEN_BYTES, AiAppChatLinkAuthorityBindingV1,
};
use group_index_canister::c2c_issue_ai_app_chat_link_authority_v1::{Response::*, *};
use rand::Rng;
use serde_bytes::ByteBuf;
use types::{CanisterId, Chat, Milliseconds};

const AUTHORITY_TTL: Milliseconds = 2 * MINUTE_IN_MS;
const MAX_GENERATION_ATTEMPTS: usize = 10;
const ENTROPY_PURPOSE: &[u8] = b"group-index/chat-link-authority/v1";

// A successful response contains a live bearer, so this method must never be traced.
#[update(guard = "caller_is_group_or_community_canister", msgpack = true)]
fn c2c_issue_ai_app_chat_link_authority_v1(args: Args) -> Response {
    mutate_state(|state| issue(args, state))
}

fn issue(args: Args, state: &mut RuntimeState) -> Response {
    if let Err(error) = validate_binding_shape(&args.binding) {
        return InvalidRequest(error);
    }
    if resolve_route(&args.binding, Some(state.env.caller()), state).is_none() {
        return InvalidRoute;
    }
    let mut rng = match crate::pr2_entropy::output_rng(state, ENTROPY_PURPOSE) {
        Ok(rng) => rng,
        Err(_) => return EntropyUnavailable,
    };
    let now = state.env.now();
    let expires_at = now.saturating_add(AUTHORITY_TTL);
    for _ in 0..MAX_GENERATION_ATTEMPTS {
        let mut raw = [0u8; AI_APP_CHAT_LINK_AUTHORITY_TOKEN_BYTES];
        rng.fill_bytes(&mut raw);
        match state
            .data
            .ai_app_chat_link_authority
            .insert(state.env.canister_id(), &raw, args.binding.clone(), expires_at, now)
        {
            Ok(()) => {
                return Success(SuccessResult {
                    token: ByteBuf::from(raw.to_vec()),
                    expires_at,
                });
            }
            Err(InsertError::TokenCollision) => continue,
            Err(InsertError::ChildCapacity | InsertError::GlobalCapacity) => return CapacityExceeded,
        }
    }
    CapacityExceeded
}

pub(crate) fn validate_binding_shape(binding: &AiAppChatLinkAuthorityBindingV1) -> Result<(), String> {
    if binding.user_id.as_principal() == candid::Principal::anonymous() {
        return Err("viewer must be a non-anonymous OpenChat user".to_string());
    }
    if matches!(binding.chat, Chat::Direct(_)) {
        return Err("direct chats do not use GroupIndex route authority".to_string());
    }
    Ok(())
}

pub(crate) fn resolve_route(
    binding: &AiAppChatLinkAuthorityBindingV1,
    expected_child: Option<candid::Principal>,
    state: &RuntimeState,
) -> Option<CanisterId> {
    let (child, owner) = match binding.chat {
        Chat::Group(chat_id) => (
            candid::Principal::from(chat_id),
            state.data.local_index_map.get_index_canister_for_group(&chat_id),
        ),
        Chat::Channel(community_id, _) => (
            candid::Principal::from(community_id),
            state.data.local_index_map.get_index_canister_for_community(&community_id),
        ),
        Chat::Direct(_) => return None,
    };
    if expected_child.is_some_and(|expected| expected != child) || owner != Some(binding.local_user_index_canister_id) {
        return None;
    }
    owner
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use types::UserId;

    fn binding(group: Principal, owner: Principal) -> AiAppChatLinkAuthorityBindingV1 {
        AiAppChatLinkAuthorityBindingV1 {
            local_user_index_canister_id: owner,
            user_id: UserId::from(Principal::from_slice(&[9])),
            chat: Chat::Group(group.into()),
            app_id: 7,
            app_revision: 8,
        }
    }

    #[test]
    fn exact_child_and_current_owner_route_are_required() {
        let owner = Principal::from_slice(&[1]);
        let other_lui = Principal::from_slice(&[2]);
        let group = Principal::from_slice(&[7]);
        let mut data = crate::Data::default();
        data.local_index_map.add_index(owner);
        data.local_index_map.add_index(other_lui);
        data.local_index_map.add_group(owner, group.into());
        let state = RuntimeState::new(Box::new(utils::env::test::TestEnv::default()), data);
        assert_eq!(resolve_route(&binding(group, owner), Some(group), &state), Some(owner));
        assert!(resolve_route(&binding(group, owner), Some(Principal::from_slice(&[8])), &state).is_none());
        assert!(resolve_route(&binding(group, other_lui), Some(group), &state).is_none());
    }

    #[test]
    fn direct_and_anonymous_viewer_bindings_are_rejected() {
        let mut value = binding(Principal::from_slice(&[7]), Principal::from_slice(&[1]));
        value.chat = Chat::Direct(Principal::from_slice(&[8]).into());
        assert!(validate_binding_shape(&value).is_err());
        value.chat = Chat::Group(Principal::from_slice(&[7]).into());
        value.user_id = Principal::anonymous().into();
        assert!(validate_binding_shape(&value).is_err());
    }
}
