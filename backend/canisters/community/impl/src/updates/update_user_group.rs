use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::update_user_group::{Response::*, *};
use utils::text_validation::{validate_user_group_name, UsernameValidationError};

#[update(candid = true, msgpack = true)]
#[trace]
fn update_user_group(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| update_user_group_impl(args, state))
}

fn update_user_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended().value {
            return UserSuspended;
        } else if member.lapsed().value {
            return UserLapsed;
        }

        if !member.role().can_manage_user_groups(&state.data.permissions) {
            NotAuthorized
        } else if let Err(error) = args.name.as_ref().map_or(Ok(()), |n| validate_user_group_name(n)) {
            match error {
                UsernameValidationError::TooShort(s) => NameTooShort(s),
                UsernameValidationError::TooLong(l) => NameTooLong(l),
                UsernameValidationError::Invalid => NameInvalid,
            }
        } else {
            let now = state.env.now();

            if state
                .data
                .members
                .update_user_group(args.user_group_id, args.name, args.users_to_add, args.users_to_remove, now)
            {
                handle_activity_notification(state);
                Success
            } else {
                UserGroupNotFound
            }
        }
    } else {
        NotAuthorized
    }
}
