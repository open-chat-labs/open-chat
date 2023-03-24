use crate::activity_notifications::handle_activity_notification;
use crate::model::participants::ChangeRoleResult;
use crate::updates::change_role::Response::*;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::change_role::*;
use ic_cdk_macros::update;
use types::{CanisterId, Role, RoleChanged};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn change_role(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        caller,
        user_index_canister_id,
        is_caller_owner,
    } = match read_state(prepare) {
        Ok(result) => result,
        Err(response) => return response,
    };

    let mut is_platform_moderator = false;
    if matches!(args.new_role, Role::Owner) && !is_caller_owner {
        match lookup_user(caller, user_index_canister_id).await {
            Ok(user) if user.is_platform_moderator => is_platform_moderator = true,
            Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
            Err(LookupUserError::InternalError(error)) => return InternalError(error),
        };
    }

    mutate_state(|state| change_role_impl(args, is_platform_moderator, state))
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
    is_caller_owner: bool,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    if let Some(participant) = state.data.participants.get(caller) {
        Ok(PrepareResult {
            caller,
            user_index_canister_id: state.data.user_index_canister_id,
            is_caller_owner: participant.role.is_owner(),
        })
    } else {
        Err(CallerNotInGroup)
    }
}

fn change_role_impl(args: Args, is_platform_moderator: bool, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    let now = state.env.now();
    let event = match state.data.participants.change_role(
        caller,
        &args.user_id,
        args.new_role,
        &state.data.permissions,
        is_platform_moderator,
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

    state.data.events.push_main_event(event, args.correlation_id, now);
    handle_activity_notification(state);
    Success
}
