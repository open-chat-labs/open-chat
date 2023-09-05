use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::set_member_display_name::{Response::*, *};
use ic_cdk_macros::update;
use types::Timestamped;
use utils::text_validation::{validate_display_name, UsernameValidationError};

#[update]
#[trace]
fn set_member_display_name(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_member_display_name_impl(args, state))
}

fn set_member_display_name_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    let now = state.env.now();

    match state.data.members.get_mut(caller) {
        Some(member) if member.suspended.value => UserSuspended,
        Some(member) => {
            if let Some(display_name) = args.display_name.as_ref() {
                match validate_display_name(display_name) {
                    Ok(_) => {}
                    Err(UsernameValidationError::TooShort(min_length)) => return DisplayNameTooShort(min_length),
                    Err(UsernameValidationError::TooLong(max_length)) => return DisplayNameTooLong(max_length),
                    Err(UsernameValidationError::Invalid) => return DisplayNameInvalid,
                };
            }

            member.display_name = Timestamped::new(args.display_name, now);
            handle_activity_notification(state);
            Success
        }
        None => UserNotInCommunity,
    }
}
