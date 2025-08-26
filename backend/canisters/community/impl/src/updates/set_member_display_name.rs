use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::set_member_display_name::*;
use oc_error_codes::OCErrorCode;
use types::{Achievement, OCResult};
use utils::text_validation::{UsernameValidationError, validate_display_name};

#[update(msgpack = true)]
#[trace]
fn set_member_display_name(args: Args) -> Response {
    execute_update(|state| set_member_display_name_impl(args, state)).into()
}

fn set_member_display_name_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if let Some(display_name) = args.display_name.as_ref()
        && let Err(error) = validate_display_name(display_name)
    {
        return Err(match error {
            UsernameValidationError::TooShort(s) => OCErrorCode::DisplayNameTooShort.with_message(s.min_length),
            UsernameValidationError::TooLong(l) => OCErrorCode::DisplayNameTooLong.with_message(l.max_length),
            UsernameValidationError::Invalid => OCErrorCode::InvalidDisplayName.into(),
        });
    };

    let now = state.env.now();
    state.data.members.set_display_name(member.user_id, args.display_name, now);

    if args.new_achievement {
        state.notify_user_of_achievement(member.user_id, Achievement::SetCommunityDisplayName, now);
    }

    handle_activity_notification(state);
    Ok(())
}
