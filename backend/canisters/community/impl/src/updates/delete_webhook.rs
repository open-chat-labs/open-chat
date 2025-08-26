use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::delete_webhook::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn delete_webhook(args: Args) -> Response {
    execute_update(|state| delete_webhook_impl(args, state)).into()
}

fn delete_webhook_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_calling_member(true)?.user_id;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let member = channel.chat.members.get_verified_member(user_id)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let now = state.env.now();

    if channel.chat.webhooks.remove(&args.id, now).is_none() {
        return Err(OCErrorCode::WebhookNotFound.into());
    }

    handle_activity_notification(state);
    Ok(())
}
