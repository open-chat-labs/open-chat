use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use fire_and_forget_handler::FireAndForgetHandler;
use group_canister::remove_participant::*;
use group_chat_core::GroupRoleInternal;
use local_user_index_canister_c2c_client::lookup_user;
use msgpack::serialize_then_unwrap;
use oc_error_codes::OCErrorCode;
use types::{BotCaller, BotPermissions, Caller, CanisterId, ChatPermission, OCResult, UnitResult, UserId};
use user_canister::c2c_remove_from_group;

#[update(msgpack = true)]
#[trace]
async fn block_user(args: group_canister::block_user::Args) -> UnitResult {
    execute_update_async(|| remove_participant_impl(args.user_id, true, None))
        .await
        .into()
}

#[update(msgpack = true)]
#[trace]
async fn remove_participant(args: Args) -> UnitResult {
    execute_update_async(|| remove_participant_impl(args.user_id, false, None))
        .await
        .into()
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
async fn c2c_bot_remove_user(args: group_canister::c2c_bot_remove_user::Args) -> UnitResult {
    execute_update_async(|| {
        remove_participant_impl(
            args.user_id,
            args.block,
            Some(Caller::BotV2(BotCaller {
                bot: args.bot_id,
                initiator: args.initiator.clone(),
            })),
        )
    })
    .await
    .into()
}

async fn remove_participant_impl(user_to_remove: UserId, block: bool, ext_caller: Option<Caller>) -> OCResult {
    // Check the caller can remove the user
    let prepare_result = match read_state(|state| prepare(user_to_remove, block, ext_caller, state))? {
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
    mutate_state(|state| commit(user_to_remove, block, prepare_result.remove, prepare_result.removed_by, state))
}

struct PrepareResult {
    removed_by: Caller,
    local_user_index_canister_id: CanisterId,
    is_user_to_remove_an_owner: bool,
    remove: bool,
}

fn prepare(
    user_to_remove: UserId,
    block: bool,
    ext_caller: Option<Caller>,
    state: &RuntimeState,
) -> OCResult<Option<PrepareResult>> {
    state.data.verify_not_frozen()?;

    if block && !state.data.chat.is_public.value {
        return Err(OCErrorCode::ChatNotPublic.into());
    }

    let caller = state.verified_caller(ext_caller)?;

    if caller.agent() == user_to_remove {
        Err(OCErrorCode::CannotRemoveSelf.into())
    } else {
        let (remove, user_to_remove_role) = match state.data.chat.members.get(&user_to_remove) {
            Some(member_to_remove) => (true, member_to_remove.role().value),
            None => {
                if !state.data.chat.invited_users.contains(&user_to_remove)
                    && (!block || state.data.chat.members.is_blocked(&user_to_remove))
                {
                    return Err(OCErrorCode::NoChange.into());
                }
                (false, GroupRoleInternal::Member) // We still want to remove an invite and/or block the user
            }
        };

        if let Caller::BotV2(bot_caller) = &caller {
            if !state.data.is_bot_permitted(
                &bot_caller.bot,
                &bot_caller.initiator,
                &BotPermissions::from_chat_permission(ChatPermission::RemoveMembers),
            ) {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
        }

        if let Some(initiator) = caller.initiator() {
            let member = state.data.chat.members.get_verified_member(initiator)?;
            if !member
                .role()
                .can_remove_members_with_role(user_to_remove_role, &state.data.chat.permissions)
            {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
        }

        Ok(Some(PrepareResult {
            removed_by: caller,
            local_user_index_canister_id: state.data.local_user_index_canister_id,
            is_user_to_remove_an_owner: user_to_remove_role.is_owner(),
            remove,
        }))
    }
}

fn commit(user_to_remove: UserId, block: bool, remove: bool, caller: Caller, state: &mut RuntimeState) -> OCResult {
    let agent = caller.agent();

    let bot_notification = state
        .data
        .chat
        .remove_member(caller, user_to_remove, block, state.env.now())?;

    if remove {
        state.data.remove_user(user_to_remove, None);
    }

    state.push_bot_notification(bot_notification);
    handle_activity_notification(state);

    if remove {
        // Fire-and-forget call to notify the user canister
        remove_membership_from_user_canister(
            user_to_remove,
            agent,
            block,
            state.data.chat.name.value.clone(),
            state.data.chat.is_public.value,
            &mut state.data.fire_and_forget_handler,
        );
    }

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
