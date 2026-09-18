use crate::guards::caller_is_owner;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use oc_error_codes::OCErrorCode;
use std::collections::HashSet;
use types::{MessageIndex, OCResult};
use user_canister::search_messages::{Response::*, *};

const MIN_TERM_LENGTH: u8 = 3;
const MAX_TERM_LENGTH: u8 = 30;

#[query(guard = "caller_is_owner", msgpack = true)]
fn search_messages(args: Args) -> Response {
    match read_state(|state| search_messages_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn search_messages_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    // Compared as a `usize`, since casting the length to a `u8` would let a long term wrap around
    let term_length = args.search_term.len();

    if term_length < MIN_TERM_LENGTH as usize {
        return Err(OCErrorCode::TermTooShort.with_message(MIN_TERM_LENGTH));
    }

    if term_length > MAX_TERM_LENGTH as usize {
        return Err(OCErrorCode::TermTooLong.with_message(MAX_TERM_LENGTH));
    }

    let my_index = state.caller_user_index_or_trap();
    let matches = state.with_direct_chat(my_index, args.user_id.into(), |chat| {
        chat.events()
            .search_messages(MessageIndex::default(), &args.search_term, &HashSet::new(), args.max_results)
    })?;

    Ok(SuccessResult { matches })
}
