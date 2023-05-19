use crate::activity_notifications::handle_activity_notification;
use crate::updates::change_role::Response::*;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::change_role::*;
use group_members::ChangeRoleResult;
use ic_cdk_macros::update;
use types::{CanisterId, RoleChanged, UserId};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn change_role(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        caller_id,
        user_index_canister_id,
        is_caller_owner,
        is_user_owner,
    } = match read_state(|state| prepare(args.user_id, state)) {
        Ok(result) => result,
        Err(response) => return response,
    };

    // Either lookup whether the caller is a platform moderator so they can promote themselves to owner
    // Or lookup whether the user is a platform moderator to prevent them being demoted from owner
    let mut is_caller_platform_moderator = false;
    let mut is_user_platform_moderator = false;
    let lookup_caller = !is_caller_owner && args.new_role.is_owner() && caller_id == args.user_id;
    let lookup_target = is_caller_owner && is_user_owner && caller_id != args.user_id;

    if lookup_caller || lookup_target {
        let user_id = if lookup_caller { caller_id } else { args.user_id };
        match lookup_user(user_id.into(), user_index_canister_id).await {
            Ok(user) if user.is_platform_moderator => {
                if lookup_caller {
                    is_caller_platform_moderator = true;
                } else {
                    is_user_platform_moderator = true;
                }
            }
            Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
            Err(LookupUserError::InternalError(error)) => return InternalError(error),
        };
    }

    mutate_state(|state| {
        change_role_impl(
            args,
            caller_id,
            is_caller_platform_moderator,
            is_user_platform_moderator,
            state,
        )
    })
}

struct PrepareResult {
    caller_id: UserId,
    user_index_canister_id: CanisterId,
    is_caller_owner: bool,
    is_user_owner: bool,
}

fn prepare(user_id: UserId, state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        Ok(PrepareResult {
            caller_id: member.user_id,
            user_index_canister_id: state.data.user_index_canister_id,
            is_caller_owner: member.role.is_owner(),
            is_user_owner: state.data.chat.members.get(&user_id).map_or(false, |u| u.role.is_owner()),
        })
    } else {
        Err(CallerNotInGroup)
    }
}

fn change_role_impl(
    args: Args,
    caller_id: UserId,
    is_caller_platform_moderator: bool,
    is_user_platform_moderator: bool,
    state: &mut RuntimeState,
) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let now = state.env.now();
    let event = match state.data.chat.members.change_role(
        caller_id,
        args.user_id,
        args.new_role,
        &state.data.chat.permissions,
        is_caller_platform_moderator,
        is_user_platform_moderator,
    ) {
        ChangeRoleResult::Success(r) => {
            let event = RoleChanged {
                user_ids: vec![args.user_id],
                old_role: r.prev_role,
                new_role: args.new_role,
                changed_by: r.caller_id,
            };
            ChatEventInternal::RoleChanged(Box::new(event))
        }
        ChangeRoleResult::NotAuthorized => return NotAuthorized,
        ChangeRoleResult::Invalid => return Invalid,
        ChangeRoleResult::UserNotInGroup => return UserNotInGroup,
        ChangeRoleResult::Unchanged => return Success,
        ChangeRoleResult::CallerNotInGroup => return CallerNotInGroup,
        ChangeRoleResult::UserSuspended => return UserSuspended,
    };

    state.data.chat.events.push_main_event(event, args.correlation_id, now);
    handle_activity_notification(state);
    Success
}
