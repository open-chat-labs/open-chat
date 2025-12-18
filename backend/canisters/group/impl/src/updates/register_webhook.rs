use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::register_webhook::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use utils::{
    document::try_parse_data_url,
    text_validation::{UsernameValidationError, validate_username_custom},
};

#[update(msgpack = true)]
#[trace]
fn register_webhook(args: Args) -> Response {
    match execute_update(|state| register_webhook_impl(args, state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

fn register_webhook_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    match validate_username_custom(&args.name, 3, 15, &[]) {
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

    let Some(webhook_id) = state.data.chat.webhooks.register(args.name, avatar, state.env.rng(), now) else {
        return Err(OCErrorCode::NameTaken.into());
    };

    let webhook = state.data.chat.webhooks.get(&webhook_id).unwrap();

    let result = SuccessResult {
        id: webhook_id,
        secret: webhook.secret.clone(),
        avatar_id: webhook.avatar.as_ref().map(|a| a.id),
    };

    handle_activity_notification(state);

    Ok(result)
}
