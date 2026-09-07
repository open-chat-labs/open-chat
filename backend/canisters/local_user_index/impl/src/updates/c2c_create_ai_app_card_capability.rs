use crate::action_deposit_envelope;
use crate::guards::caller_is_local_child_canister;
use crate::read_state;
use canister_api_macros::update;
use local_user_index_canister::c2c_create_ai_app_card_capability::{Response::*, *};
use types::{AiAppCardContext, Chat};

#[update(guard = "caller_is_local_child_canister", msgpack = true)]
async fn c2c_create_ai_app_card_capability(args: Args) -> Response {
    if matches!(args.chat, Chat::Direct(_)) && !args.authority.is_empty() {
        return InvalidRequest("direct chat must not carry group route authority".to_string());
    }
    let caller = ic_cdk::api::msg_caller();
    let expected_user_id = args.user_id;
    let expected_chat = args.chat;
    let expected_member_user_ids = args.member_user_ids.clone();
    let caller_registration = read_state(|state| authoritative_child_registration(state, caller));
    if let Err(error) = validate_authoritative_child_context(
        args.user_id,
        args.chat,
        &args.member_user_ids,
        caller,
        caller_registration.kind,
    ) {
        return InvalidRequest(error);
    }
    let chat_key = match action_deposit_envelope::chat_key(&args.chat, &args.member_user_ids) {
        Ok(value) => value,
        Err(error) => return InvalidRequest(error),
    };
    let context = AiAppCardContext {
        user_id: args.user_id,
        chat: args.chat,
        chat_key,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        app_id: args.app_id,
        app_revision: args.app_revision,
        action_id: args.action_id,
    };
    let user_index_canister_id = read_state(|state| state.data.user_index_canister_id);
    match user_index_canister_c2c_client::c2c_create_ai_app_card_capability(
        user_index_canister_id,
        &user_index_canister::c2c_create_ai_app_card_capability::Args {
            context,
            content_hash: args.content_hash,
            recipient_key_scheme: args.recipient_key_scheme,
            recipient_public_key: args.recipient_public_key,
            authority: args.authority,
        },
    )
    .await
    {
        Ok(user_index_canister::c2c_create_ai_app_card_capability::Response::Success(result)) => {
            let current_registration = read_state(|state| authoritative_child_registration(state, caller));
            if current_registration != caller_registration {
                return InvalidRequest("local child registration changed while capability was created".to_string());
            }
            if let Err(error) = validate_authoritative_child_context(
                expected_user_id,
                expected_chat,
                &expected_member_user_ids,
                caller,
                current_registration.kind,
            ) {
                return InvalidRequest(error);
            }
            Success(SuccessResult {
                token: result.token,
                expires_at: result.expires_at,
                context: result.context,
            })
        }
        Ok(user_index_canister::c2c_create_ai_app_card_capability::Response::InvalidProvenance) => InvalidProvenance,
        Ok(user_index_canister::c2c_create_ai_app_card_capability::Response::AppUnavailable) => AppUnavailable,
        Ok(user_index_canister::c2c_create_ai_app_card_capability::Response::InvalidRequest(error)) => InvalidRequest(error),
        Ok(user_index_canister::c2c_create_ai_app_card_capability::Response::Error(_)) | Err(_) => {
            Error("AI-app capability service unavailable".to_string())
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum AuthoritativeChildKind {
    User,
    Group,
    Community,
    Unknown,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct AuthoritativeChildRegistration {
    pub kind: AuthoritativeChildKind,
    pub generation: u64,
}

pub(crate) fn authoritative_child_registration(
    state: &crate::RuntimeState,
    caller: candid::Principal,
) -> AuthoritativeChildRegistration {
    let group_id = types::ChatId::from(caller);
    let community_id = types::CommunityId::from(caller);
    let user_id = types::UserId::from(caller);
    if state.data.local_groups.contains(&group_id) {
        AuthoritativeChildRegistration {
            kind: AuthoritativeChildKind::Group,
            generation: state.data.local_groups.registration_generation(&group_id),
        }
    } else if state.data.local_communities.contains(&community_id) {
        AuthoritativeChildRegistration {
            kind: AuthoritativeChildKind::Community,
            generation: state.data.local_communities.registration_generation(&community_id),
        }
    } else if state.data.local_users.contains(&user_id) {
        AuthoritativeChildRegistration {
            kind: AuthoritativeChildKind::User,
            generation: state.data.local_users.registration_generation(&user_id),
        }
    } else {
        AuthoritativeChildRegistration {
            kind: AuthoritativeChildKind::Unknown,
            generation: 0,
        }
    }
}

pub(crate) fn validate_authoritative_child_context(
    user_id: types::UserId,
    chat: Chat,
    member_user_ids: &[types::UserId],
    caller: candid::Principal,
    caller_kind: AuthoritativeChildKind,
) -> Result<(), String> {
    if !member_user_ids.contains(&user_id) {
        return Err("authoritative member list does not contain the viewer".to_string());
    }
    match chat {
        Chat::Direct(other) => {
            if caller_kind != AuthoritativeChildKind::User || user_id.canister_id() != caller {
                return Err("caller is not the viewer's exact local user canister".to_string());
            }
            let other_user_id: types::UserId = other.into();
            if other_user_id == user_id
                || member_user_ids.len() != 2
                || !member_user_ids.contains(&other_user_id)
                || member_user_ids.iter().filter(|member| **member == user_id).count() != 1
            {
                return Err("direct chat must contain the canonical distinct participant pair".to_string());
            }
            Ok(())
        }
        Chat::Group(chat_id) if caller_kind != AuthoritativeChildKind::Group || candid::Principal::from(chat_id) != caller => {
            Err("caller is not the asserted local group canister".to_string())
        }
        Chat::Channel(community_id, _)
            if caller_kind != AuthoritativeChildKind::Community || candid::Principal::from(community_id) != caller =>
        {
            Err("caller is not the asserted local community canister".to_string())
        }
        Chat::Group(_) | Chat::Channel(_, _) => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use serde_bytes::ByteBuf;
    use types::{ChatId, MessageId, UserId};

    fn user(value: u8) -> UserId {
        Principal::from_slice(&[value]).into()
    }

    fn args(group: Principal, viewer: UserId) -> Args {
        Args {
            user_id: viewer,
            chat: Chat::Group(ChatId::from(group)),
            thread_root_message_index: None,
            message_id: MessageId::from(1u64),
            app_id: 1,
            app_revision: 2,
            action_id: "action".to_string(),
            content_hash: [3; 32],
            member_user_ids: vec![viewer],
            recipient_key_scheme: "opaque-v1".to_string(),
            recipient_public_key: ByteBuf::from(vec![2; 48]),
            authority: ByteBuf::from(vec![3; types::AI_APP_CARD_TOKEN_BYTES]),
        }
    }

    #[test]
    fn child_cannot_assert_another_chat_or_nonmember_viewer() {
        let caller = Principal::from_slice(&[7]);
        let viewer: UserId = Principal::from_slice(&[8]).into();
        let valid = args(caller, viewer);
        assert!(
            validate_authoritative_child_context(
                valid.user_id,
                valid.chat,
                &valid.member_user_ids,
                caller,
                AuthoritativeChildKind::Group,
            )
            .is_ok()
        );
        let wrong = args(Principal::from_slice(&[9]), viewer);
        assert!(
            validate_authoritative_child_context(
                wrong.user_id,
                wrong.chat,
                &wrong.member_user_ids,
                caller,
                AuthoritativeChildKind::Group,
            )
            .is_err()
        );
        let mut missing = args(caller, viewer);
        missing.member_user_ids.clear();
        assert!(
            validate_authoritative_child_context(
                missing.user_id,
                missing.chat,
                &missing.member_user_ids,
                caller,
                AuthoritativeChildKind::Group,
            )
            .is_err()
        );
    }

    #[test]
    fn child_kind_must_match_the_asserted_chat_kind() {
        let caller = Principal::from_slice(&[7]);
        let viewer: UserId = Principal::from_slice(&[8]).into();
        let group = args(caller, viewer);
        assert!(
            validate_authoritative_child_context(
                group.user_id,
                group.chat,
                &group.member_user_ids,
                caller,
                AuthoritativeChildKind::User,
            )
            .is_err(),
            "a user child cannot impersonate a group"
        );

        let channel = Chat::Channel(caller.into(), 1u32.into());
        assert!(
            validate_authoritative_child_context(viewer, channel, &[viewer], caller, AuthoritativeChildKind::Group,).is_err(),
            "a group child cannot impersonate a community channel"
        );
        assert!(
            validate_authoritative_child_context(viewer, channel, &[viewer], caller, AuthoritativeChildKind::Community,)
                .is_ok()
        );
    }

    #[test]
    fn group_child_authority_does_not_depend_on_the_viewers_home_lui() {
        // A group canister is owned by the LUI receiving this call even when a member's user
        // canister lives under another LUI. Authority is the exact child id + child kind + current
        // membership assertion, not a user-home-shard equality check.
        let local_group = Principal::from_slice(&[7]);
        let cross_shard_viewer: UserId = Principal::from_slice(&[99]).into();
        let chat = Chat::Group(local_group.into());
        assert!(
            validate_authoritative_child_context(
                cross_shard_viewer,
                chat,
                &[cross_shard_viewer],
                local_group,
                AuthoritativeChildKind::Group,
            )
            .is_ok()
        );
    }

    #[test]
    fn indexed_direct_card_relay_uses_the_host_but_preserves_exact_members() {
        let host = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 42, 1, 1]);
        let viewer = UserId::new_indexed(host, 1);
        let peer = UserId::new_indexed(host, 2);
        let other = UserId::new_indexed(host, 3);
        let chat = Chat::Direct(peer.into());
        assert!(
            validate_authoritative_child_context(viewer, chat, &[viewer, peer], host, AuthoritativeChildKind::User).is_ok()
        );
        assert!(
            validate_authoritative_child_context(viewer, chat, &[other, peer], host, AuthoritativeChildKind::User).is_err()
        );
        assert!(
            validate_authoritative_child_context(
                viewer,
                chat,
                &[viewer, peer],
                viewer.as_principal(),
                AuthoritativeChildKind::User
            )
            .is_err()
        );
        assert!(
            validate_authoritative_child_context(viewer, chat, &[viewer, peer], host, AuthoritativeChildKind::Group).is_err()
        );
    }

    #[test]
    fn direct_card_relay_accepts_only_the_exact_user_child_and_canonical_pair() {
        let viewer = user(7);
        let peer = user(8);
        let caller = viewer.canister_id();

        assert!(
            validate_authoritative_child_context(
                viewer,
                Chat::Direct(peer.into()),
                &[peer, viewer],
                caller,
                AuthoritativeChildKind::User,
            )
            .is_ok(),
            "a current User child must be allowed to relay a direct card for its exact two-user chat"
        );
    }

    #[test]
    fn direct_card_relay_rejects_wrong_or_reclassified_user_children() {
        let viewer = user(7);
        let peer = user(8);
        let chat = Chat::Direct(peer.into());
        let members = [viewer, peer];

        assert!(
            validate_authoritative_child_context(
                viewer,
                chat,
                &members,
                Principal::from_slice(&[9]),
                AuthoritativeChildKind::User,
            )
            .is_err(),
            "another User canister must not relay the viewer's direct card"
        );
        assert!(
            validate_authoritative_child_context(viewer, chat, &members, viewer.canister_id(), AuthoritativeChildKind::Group,)
                .is_err(),
            "a reclassified child must lose direct-card authority"
        );
        assert!(
            validate_authoritative_child_context(
                viewer,
                chat,
                &members,
                viewer.canister_id(),
                AuthoritativeChildKind::Unknown,
            )
            .is_err(),
            "an unregistered child must not relay a direct card"
        );
    }

    #[test]
    fn direct_card_relay_rejects_self_extra_missing_and_unrelated_members() {
        let viewer = user(7);
        let peer = user(8);
        let mallory = user(9);
        let caller = viewer.canister_id();

        for (chat, members) in [
            (Chat::Direct(viewer.into()), vec![viewer, viewer]),
            (Chat::Direct(peer.into()), vec![viewer]),
            (Chat::Direct(peer.into()), vec![viewer, peer, mallory]),
            (Chat::Direct(mallory.into()), vec![viewer, peer]),
        ] {
            assert!(
                validate_authoritative_child_context(viewer, chat, &members, caller, AuthoritativeChildKind::User,).is_err(),
                "malformed direct membership must fail closed"
            );
        }
    }
}
