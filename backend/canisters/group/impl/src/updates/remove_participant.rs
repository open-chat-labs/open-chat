use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use fire_and_forget_handler::FireAndForgetHandler;
use group_canister::remove_participant::*;
use group_chat_core::GroupRoleInternal;
use local_user_index_canister_c2c_client::lookup_user;
use msgpack::serialize_then_unwrap;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, UserId};
use user_canister::c2c_remove_from_group;

#[update(msgpack = true)]
#[trace]
async fn block_user(args: group_canister::block_user::Args) -> group_canister::block_user::Response {
    execute_update_async(|| remove_participant_impl(args.user_id, true))
        .await
        .into()
}

#[update(msgpack = true)]
#[trace]
async fn remove_participant(args: Args) -> Response {
    execute_update_async(|| remove_participant_impl(args.user_id, false))
        .await
        .into()
}

async fn remove_participant_impl(user_to_remove: UserId, block: bool) -> OCResult {
    // Check the caller can remove the user
    let prepare_result = match read_state(|state| prepare(user_to_remove, block, state))? {
        Some(ok) => ok,
        None => return Ok(()),
    };

    // If the user is an owner of the group then call the local_user_index
    // to check whether they are a "platform moderator" in which case this removal
    // is not authorized
    if prepare_result.is_user_to_remove_an_owner {
        match lookup_user(user_to_remove.into(), prepare_result.local_user_index_canister_id).await? {
            Some(user) if !user.is_platform_moderator => (),
            _ => return Err(OCErrorCode::InitiatorNotAuthorized.into()),
        }
    }

    // Remove the user from the group
    mutate_state(|state| commit(user_to_remove, block, prepare_result.removed_by, state))
}

struct PrepareResult {
    removed_by: UserId,
    local_user_index_canister_id: CanisterId,
    is_user_to_remove_an_owner: bool,
}

fn prepare(user_to_remove: UserId, block: bool, state: &RuntimeState) -> OCResult<Option<PrepareResult>> {
    state.data.verify_not_frozen()?;

    if block && !state.data.chat.is_public.value {
        return Err(OCErrorCode::ChatNotPublic.into());
    }

    let member = state.get_calling_member(true)?;
    if member.user_id() == user_to_remove {
        Err(OCErrorCode::CannotRemoveSelf.into())
    } else {
        let user_to_remove_role = match state.data.chat.members.get(&user_to_remove) {
            Some(member_to_remove) => member_to_remove.role().value,
            None if block => {
                if state.data.chat.members.is_blocked(&user_to_remove) {
                    return Ok(None);
                }
                GroupRoleInternal::Member
            }
            None => return Err(OCErrorCode::TargetUserNotInChat.into()),
        };

        // Check if the caller is authorized to remove the user
        if member
            .role()
            .can_remove_members_with_role(user_to_remove_role, &state.data.chat.permissions)
        {
            Ok(Some(PrepareResult {
                removed_by: member.user_id(),
                local_user_index_canister_id: state.data.local_user_index_canister_id,
                is_user_to_remove_an_owner: user_to_remove_role.is_owner(),
            }))
        } else {
            Err(OCErrorCode::InitiatorNotAuthorized.into())
        }
    }
}

fn commit(user_to_remove: UserId, block: bool, removed_by: UserId, state: &mut RuntimeState) -> OCResult {
    let bot_notification = state
        .data
        .chat
        .remove_member(removed_by, user_to_remove, block, state.env.now())?;

    state.data.remove_user(user_to_remove, None);
    state.push_bot_notification(bot_notification);
    handle_activity_notification(state);

    // Fire-and-forget call to notify the user canister
    remove_membership_from_user_canister(
        user_to_remove,
        removed_by,
        block,
        state.data.chat.name.value.clone(),
        state.data.chat.is_public.value,
        &mut state.data.fire_and_forget_handler,
    );
    Ok(())
}

fn remove_membership_from_user_canister(
    user_to_remove: UserId,
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
        user_to_remove.into(),
        "c2c_remove_from_group_msgpack".to_string(),
        serialize_then_unwrap(args),
    );
}
