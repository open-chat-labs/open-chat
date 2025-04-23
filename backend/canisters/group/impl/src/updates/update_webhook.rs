use crate::{RuntimeState, activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::update_webhook::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use utils::document::try_parse_data_url;

#[update(candid = true, msgpack = true)]
#[trace]
fn update_webhook(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| update_webhook_impl(args, state)).into()
}

fn update_webhook_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state
        .data
        .get_member(state.env.caller())
        .ok_or(OCErrorCode::InitiatorNotInChat)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let avatar = args
        .avatar
        .map(|avatar_url| try_parse_data_url(&avatar_url))
        .transpose()
        .map_err(|_| OCErrorCode::InvalidAvatar)?;

    let now = state.env.now();

    if !state.data.webhooks.update(args.id, args.name, avatar, now) {
        return Err(OCErrorCode::WebhookNotFound.into());
    }

    handle_activity_notification(state);
    Ok(())
}
