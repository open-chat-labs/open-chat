use crate::guards::caller_is_platform_moderator;
use crate::{read_state, RuntimeState};
use ic_cdk::query;
use user_index_canister::reported_messages::{Response::*, *};

#[query(guard = "caller_is_platform_moderator")]
fn reported_messages(args: Args) -> Response {
    read_state(|state| reported_messages_impl(args, state))
}

fn reported_messages_impl(args: Args, state: &RuntimeState) -> Response {
    let reported_messages: Vec<_> = state
        .data
        .reported_messages
        .iter()
        .filter(|m| args.user_id.is_none_or(|u| m.sender.to_string() == u.to_string()))
        .collect();

    let json = serde_json::to_string(&reported_messages).unwrap();

    Success(SuccessResult { json })
}
