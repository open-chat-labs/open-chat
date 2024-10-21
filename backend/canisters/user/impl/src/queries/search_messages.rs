use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use search::Query;
use std::collections::HashSet;
use types::MessageIndex;
use user_canister::search_messages::{Response::*, *};

const MIN_TERM_LENGTH: u8 = 3;
const MAX_TERM_LENGTH: u8 = 30;

#[query(guard = "caller_is_owner", candid = true, msgpack = true)]
fn search_messages(args: Args) -> Response {
    read_state(|state| search_messages_impl(args, state))
}

fn search_messages_impl(args: Args, state: &RuntimeState) -> Response {
    let term_length = args.search_term.len() as u8;

    if term_length < MIN_TERM_LENGTH {
        return TermTooShort(MIN_TERM_LENGTH);
    }

    if term_length > MAX_TERM_LENGTH {
        return TermTooLong(MAX_TERM_LENGTH);
    }

    let direct_chat = match state.data.direct_chats.get(&args.user_id.into()) {
        None => return ChatNotFound,
        Some(dc) => dc,
    };

    let query = Query::parse(args.search_term);

    let matches = direct_chat
        .events
        .search_messages(MessageIndex::default(), query, HashSet::new(), args.max_results);

    Success(SuccessResult { matches })
}
