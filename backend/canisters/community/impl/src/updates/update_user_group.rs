use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::update_user_group::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use utils::text_validation::{UsernameValidationError, validate_user_group_name};

#[update(msgpack = true)]
#[trace]
fn update_user_group(args: Args) -> Response {
    execute_update(|state| update_user_group_impl(args, state)).into()
}

fn update_user_group_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if !member.role().can_manage_user_groups(&state.data.permissions) {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    } else if let Err(error) = args.name.as_ref().map_or(Ok(()), |n| validate_user_group_name(n)) {
        Err(match error {
            UsernameValidationError::TooShort(s) => OCErrorCode::NameTooShort.with_json(&s),
            UsernameValidationError::TooLong(l) => OCErrorCode::NameTooLong.with_json(&l),
            UsernameValidationError::Invalid => OCErrorCode::InvalidName.into(),
        })
    } else {
        let now = state.env.now();

        if state
            .data
            .members
            .update_user_group(args.user_group_id, args.name, args.users_to_add, args.users_to_remove, now)
        {
            handle_activity_notification(state);
            Ok(())
        } else {
            Err(OCErrorCode::UserGroupNotFound.into())
        }
    }
}
