use crate::RuntimeState;
use crate::read_state;
use canister_api_macros::query;
use group_canister::webhook::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[query(msgpack = true)]
fn webhook(args: Args) -> Response {
    match read_state(|state| webhook_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn webhook_impl(args: Args, state: &RuntimeState) -> OCResult<String> {
    let member = state.get_calling_member(true)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let webhook = state.data.webhooks.get(&args.id).ok_or(OCErrorCode::WebhookNotFound)?;

    Ok(format!(
        "/group/{}/webhook/{}/{}",
        state.env.canister_id(),
        args.id,
        webhook.secret
    ))
}
