use crate::{RuntimeState, activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::regenerate_webhook::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(candid = true, msgpack = true)]
#[trace]
fn regenerate_webhook(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| regenerate_webhook_impl(args, state)).into()
}

fn regenerate_webhook_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_calling_member(true)?.user_id;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let member = channel.chat.members.get_verified_member(user_id)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let now = state.env.now();

    if !channel.chat.webhooks.regenerate(args.id, state.env.rng(), now) {
        return Err(OCErrorCode::WebhookNotFound.into());
    }

    handle_activity_notification(state);
    Ok(())
}
