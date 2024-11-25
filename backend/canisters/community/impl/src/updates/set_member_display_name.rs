use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::set_member_display_name::{Response::*, *};
use types::Achievement;
use utils::text_validation::{validate_display_name, UsernameValidationError};

#[update(candid = true, msgpack = true)]
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

    let user_id = match state.data.members.get(caller) {
        Some(member) if member.suspended().value => return UserSuspended,
        Some(member) if member.lapsed().value => return UserLapsed,
        Some(member) => {
            if let Some(display_name) = args.display_name.as_ref() {
                match validate_display_name(display_name) {
                    Ok(_) => {}
                    Err(UsernameValidationError::TooShort(s)) => return DisplayNameTooShort(s.min_length as u16),
                    Err(UsernameValidationError::TooLong(l)) => return DisplayNameTooLong(l.max_length as u16),
                    Err(UsernameValidationError::Invalid) => return DisplayNameInvalid,
                };
            }
            member.user_id
        }
        None => return UserNotInCommunity,
    };

    state.data.members.set_display_name(user_id, args.display_name, now);

    if args.new_achievement {
        state
            .data
            .notify_user_of_achievement(user_id, Achievement::SetCommunityDisplayName);
    }

    handle_activity_notification(state);
    Success
}
