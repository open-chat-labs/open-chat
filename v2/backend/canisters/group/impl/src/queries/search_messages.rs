use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::search_messages::{Response::*, *};
use ic_cdk_macros::query;

const MIN_TERM_LENGTH: u8 = 2;
const MAX_TERM_LENGTH: u8 = 20;

#[query]
fn search_messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| search_messages_impl(args, state.borrow().as_ref().unwrap()))
}

fn search_messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let term_length = args.search_term.len() as u8;

    if term_length < MIN_TERM_LENGTH {
        return TermTooShort(MIN_TERM_LENGTH);
    }

    if term_length > MAX_TERM_LENGTH {
        return TermTooLong(MAX_TERM_LENGTH);
    }

    let caller = runtime_state.env.caller();
    let participant = match runtime_state.data.participants.get(caller) {
        None => return NotInGroup,
        Some(p) => p,
    };

    let matches = runtime_state.data.events.search_messages(
        runtime_state.env.now(),
        participant.min_visible_event_index,
        &args.search_term,
        args.max_results,
    );

    Success(SuccessResult { matches })
}
