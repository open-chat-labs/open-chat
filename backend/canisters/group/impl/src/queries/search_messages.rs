use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_canister::search_messages::{Response::*, *};
use group_chat_core::SearchResults;

#[query(candid = true, msgpack = true)]
fn search_messages(args: Args) -> Response {
    read_state(|state| search_messages_impl(args, state))
}

fn search_messages_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(user_id) = state.data.lookup_user_id(caller) {
        match state
            .data
            .chat
            .search(user_id, args.search_term, args.users, args.max_results)
        {
            SearchResults::Success(matches) => Success(SuccessResult { matches }),
            SearchResults::InvalidTerm => InvalidTerm,
            SearchResults::TermTooLong(v) => TermTooLong(v),
            SearchResults::TermTooShort(v) => TermTooShort(v),
            SearchResults::TooManyUsers(v) => TooManyUsers(v),
            SearchResults::UserNotInGroup => CallerNotInGroup,
        }
    } else {
        CallerNotInGroup
    }
}
