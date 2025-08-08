use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::create_user_group::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;
use utils::text_validation::{UsernameValidationError, validate_user_group_name};

#[update(msgpack = true)]
#[trace]
fn create_user_group(args: Args) -> Response {
    match execute_update(|state| create_user_group_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn create_user_group_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if !member.role().can_manage_user_groups(&state.data.permissions) {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    } else if let Err(error) = validate_user_group_name(&args.name) {
        Err(match error {
            UsernameValidationError::TooShort(s) => OCErrorCode::NameTooShort.with_json(&s),
            UsernameValidationError::TooLong(l) => OCErrorCode::NameTooLong.with_json(&l),
            UsernameValidationError::Invalid => OCErrorCode::InvalidName.into(),
        })
    } else {
        let now = state.env.now();
        let rng = state.env.rng();

        if let Some(user_group_id) = state.data.members.create_user_group(args.name, args.user_ids, rng, now) {
            handle_activity_notification(state);
            Ok(SuccessResult { user_group_id })
        } else {
            Err(OCErrorCode::NameTaken.into())
        }
    }
}
