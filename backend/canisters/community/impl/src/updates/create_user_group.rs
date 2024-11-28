use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::create_user_group::{Response::*, *};
use utils::text_validation::{validate_user_group_name, UsernameValidationError};

#[update(candid = true, msgpack = true)]
#[trace]
fn create_user_group(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| create_user_group_impl(args, state))
}

fn create_user_group_impl(args: Args, state: &mut RuntimeState) -> Response {
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
        } else if let Err(error) = validate_user_group_name(&args.name) {
            match error {
                UsernameValidationError::TooShort(s) => NameTooShort(s),
                UsernameValidationError::TooLong(l) => NameTooLong(l),
                UsernameValidationError::Invalid => NameInvalid,
            }
        } else {
            let now = state.env.now();
            let rng = state.env.rng();

            if let Some(user_group_id) = state.data.members.create_user_group(args.name, args.user_ids, rng, now) {
                handle_activity_notification(state);
                Success(SuccessResult { user_group_id })
            } else {
                NameTaken
            }
        }
    } else {
        NotAuthorized
    }
}
