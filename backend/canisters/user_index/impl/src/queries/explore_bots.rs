use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use user_index_canister::explore_bots::{Response::*, *};

const MIN_TERM_LENGTH: u8 = 2;
const MAX_TERM_LENGTH: u8 = 20;

#[query(candid = true, msgpack = true)]
fn explore_bots(args: Args) -> Response {
    read_state(|state| explore_bots_impl(args, state))
}

fn explore_bots_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(term_length) = args.search_term.as_ref().map(|st| st.len() as u8) {
        if term_length < MIN_TERM_LENGTH {
            return TermTooShort(MIN_TERM_LENGTH);
        }

        if term_length > MAX_TERM_LENGTH {
            return TermTooLong(MAX_TERM_LENGTH);
        }
    }

    let (matches, total) = state
        .data
        .users
        .search_bots(args.search_term, args.page_index, args.page_size);

    Success(SuccessResult { matches, total })
}
