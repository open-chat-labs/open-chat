use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::c2c_search_messages::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn c2c_search_messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_search_messages_impl(args, state.borrow().as_ref().unwrap()))
}

fn c2c_search_messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let participant = match runtime_state.data.participants.get(args.user_id.into()) {
        None => return UserNotInGroup,
        Some(p) => p,
    };

    let chat_id = runtime_state.env.canister_id().into();

    let matches = runtime_state.data.events.search_messages(
        runtime_state.env.now(),
        participant.min_visible_event_index(),
        &args.search_term,
        args.max_results,
    );

    Success(SuccessResult { chat_id, matches })
}
