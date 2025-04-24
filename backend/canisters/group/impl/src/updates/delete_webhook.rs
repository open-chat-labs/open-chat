use crate::{RuntimeState, activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::delete_webhook::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(candid = true, msgpack = true)]
#[trace]
fn delete_webhook(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_webhook_impl(args, state)).into()
}

fn delete_webhook_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    if state.data.webhooks.remove(&args.id).is_none() {
        return Err(OCErrorCode::WebhookNotFound.into());
    }

    handle_activity_notification(state);
    Ok(())
}
