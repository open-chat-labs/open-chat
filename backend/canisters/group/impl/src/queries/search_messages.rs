use crate::{read_state, RuntimeState};
use group_canister::search_messages::{Response::*, *};
use ic_cdk_macros::query;
use search::Query;

const MIN_TERM_LENGTH: u8 = 3;
const MAX_TERM_LENGTH: u8 = 30;

#[query]
fn search_messages(args: Args) -> Response {
    read_state(|state| search_messages_impl(args, state))
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
        None => return CallerNotInGroup,
        Some(p) => p,
    };
    let query = Query::parse(&args.search_term);

    let matches = runtime_state.data.events.main.search_messages(
        runtime_state.env.now(),
        participant.min_visible_event_index(),
        &query,
        args.max_results,
        participant.user_id,
    );

    Success(SuccessResult { matches })
}
