use crate::guards::caller_is_owner;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use oc_error_codes::OCErrorCode;
use search::simple::Query;
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
    let term_length = args.search_term.len() as u8;

    if term_length < MIN_TERM_LENGTH {
        return Err(OCErrorCode::TermTooShort.with_message(MIN_TERM_LENGTH));
    }

    if term_length > MAX_TERM_LENGTH {
        return Err(OCErrorCode::TermTooLong.with_message(MAX_TERM_LENGTH));
    }

    let direct_chat = state.data.direct_chats.get_or_err(&args.user_id.into())?;
    let query = Query::new(&args.search_term);
    let matches = direct_chat
        .events
        .search_messages(MessageIndex::default(), query, HashSet::new(), args.max_results);

    Ok(SuccessResult { matches })
}
