use crate::RuntimeState;
use crate::read_state;
use canister_api_macros::query;
use community_canister::webhook::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[query(msgpack = true)]
fn webhook(args: Args) -> Response {
    match read_state(|state| webhook_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn webhook_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let user_id = state.get_calling_member(true)?.user_id;
    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let member = channel.chat.members.get_verified_member(user_id)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let webhook = channel.chat.webhooks.get(&args.id).ok_or(OCErrorCode::WebhookNotFound)?;

    Ok(SuccessResult {
        id: args.id,
        secret: webhook.secret.clone(),
    })
}
