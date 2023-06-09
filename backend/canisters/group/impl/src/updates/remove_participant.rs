use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use fire_and_forget_handler::FireAndForgetHandler;
use group_canister::remove_participant::{Response::*, *};
use ic_cdk_macros::update;
use local_user_index_canister_c2c_client::{lookup_user, LookupUserError};
use msgpack::serialize_then_unwrap;
use types::{CanisterId, UserId};
use user_canister::c2c_remove_from_group;

#[update]
#[trace]
async fn block_user(args: group_canister::block_user::Args) -> group_canister::block_user::Response {
    if !read_state(|state| state.data.chat.is_public) {
        return group_canister::block_user::Response::GroupNotPublic;
    }

    remove_participant_impl(args.user_id, true).await.into()
}

#[update]
#[trace]
async fn remove_participant(args: Args) -> Response {
    remove_participant_impl(args.user_id, false).await
}

async fn remove_participant_impl(user_id: UserId, block: bool) -> Response {
    // Check the caller can remove the user
    let prepare_result = match read_state(|state| prepare(user_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    // If the user is an owner of the group then call the local_user_index
    // to check whether they are a "platform moderator" in which case this removal
    // is not authorized
    if prepare_result.is_user_an_owner {
        match lookup_user(user_id.into(), prepare_result.local_user_index_canister_id).await {
            Ok(user) if !user.is_platform_moderator => (),
            Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
            Err(LookupUserError::InternalError(error)) => return InternalError(error),
        }
    }

    // Remove the user from the group
    mutate_state(|state| commit(user_id, block, prepare_result.removed_by, state))
}

struct PrepareResult {
    removed_by: UserId,
    local_user_index_canister_id: CanisterId,
    is_user_an_owner: bool,
}

fn prepare(user_id: UserId, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            Err(UserSuspended)
        } else if member.user_id == user_id {
            Err(CannotRemoveSelf)
        } else {
            // Check if the caller is authorized to remove the user
            let is_user_an_owner = match state.data.chat.members.get(&user_id) {
                None => return Err(UserNotInGroup),
                Some(member_to_remove) => {
                    if member
                        .role
                        .can_remove_members_with_role(member_to_remove.role, &state.data.chat.permissions)
                    {
                        member_to_remove.role.is_owner()
                    } else {
                        return Err(NotAuthorized);
                    }
                }
            };

            Ok(PrepareResult {
                removed_by: member.user_id,
                local_user_index_canister_id: state.data.local_user_index_canister_id,
                is_user_an_owner,
            })
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn commit(user_id: UserId, block: bool, removed_by: UserId, state: &mut RuntimeState) -> Response {
    match state.data.chat.remove_member(removed_by, user_id, block, state.env.now()) {
        group_chat_core::RemoveMemberResult::Success => {
            state.data.remove_principal(user_id);

            handle_activity_notification(state);

            // Fire-and-forget call to notify the user canister
            remove_membership_from_user_canister(
                user_id,
                removed_by,
                block,
                state.data.chat.name.clone(),
                state.data.chat.is_public,
                &mut state.data.fire_and_forget_handler,
            );

            Success
        }
        group_chat_core::RemoveMemberResult::UserSuspended => UserSuspended,
        group_chat_core::RemoveMemberResult::UserNotInGroup => CallerNotInGroup,
        group_chat_core::RemoveMemberResult::TargetUserNotInGroup => UserNotInGroup,
        group_chat_core::RemoveMemberResult::NotAuthorized => NotAuthorized,
        group_chat_core::RemoveMemberResult::CannotRemoveSelf => CannotRemoveSelf,
    }
}

fn remove_membership_from_user_canister(
    user_id: UserId,
    removed_by: UserId,
    blocked: bool,
    group_name: String,
    public: bool,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    let args = c2c_remove_from_group::Args {
        removed_by,
        blocked,
        group_name,
        public,
    };
    fire_and_forget_handler.send(
        user_id.into(),
        "c2c_remove_from_group_msgpack".to_string(),
        serialize_then_unwrap(args),
    );
}
