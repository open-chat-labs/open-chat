use crate::{RuntimeState, activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::register_webhook::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use utils::{
    document::try_parse_data_url,
    text_validation::{UsernameValidationError, validate_username_custom},
};

#[update(candid = true, msgpack = true)]
#[trace]
fn register_webhook(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| register_webhook_impl(args, state)).into()
}

fn register_webhook_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    match validate_username_custom(&args.name, 3, 15) {
        Ok(_) => {}
        Err(UsernameValidationError::TooShort(_)) => return Err(OCErrorCode::InvalidRequest.with_message("name too short")),
        Err(UsernameValidationError::TooLong(_)) => return Err(OCErrorCode::InvalidRequest.with_message("name too long")),
        Err(UsernameValidationError::Invalid) => return Err(OCErrorCode::InvalidRequest.with_message("name invalid")),
    };

    let avatar = args
        .avatar
        .map(|avatar_url| try_parse_data_url(&avatar_url))
        .transpose()
        .map_err(|_| OCErrorCode::InvalidAvatar)?;

    let now = state.env.now();

    if !state.data.chat.webhooks.register(args.name, avatar, state.env.rng(), now) {
        return Err(OCErrorCode::NameTaken.into());
    }

    handle_activity_notification(state);
    Ok(())
}
