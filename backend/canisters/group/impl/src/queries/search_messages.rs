use crate::{read_state, RuntimeState};
use group_canister::search_messages::{Response::*, *};
use ic_cdk_macros::query;
use search::Query;
use std::collections::HashSet;

const MIN_TERM_LENGTH: u8 = 3;
const MAX_TERM_LENGTH: u8 = 30;
const MAX_USERS: u8 = 5;

#[query]
fn search_messages(args: Args) -> Response {
    read_state(|state| search_messages_impl(args, state))
}

fn search_messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let term_length = args.search_term.len() as u8;
    let users = args.users.unwrap_or_default();

    if users.is_empty() && term_length < MIN_TERM_LENGTH {
        return TermTooShort(MIN_TERM_LENGTH);
    }

    if term_length > MAX_TERM_LENGTH {
        return TermTooLong(MAX_TERM_LENGTH);
    }

    if users.len() as u8 > MAX_USERS {
        return TooManyUsers(MAX_USERS);
    }

    let caller = runtime_state.env.caller();
    let member = match runtime_state.data.get_member(caller) {
        None => return CallerNotInGroup,
        Some(p) => p,
    };

    let mut query = Query::parse(&args.search_term);
    query.users = HashSet::from_iter(users);

    let matches = runtime_state.data.group_chat_core.events.search_messages(
        runtime_state.env.now(),
        member.min_visible_event_index(),
        &query,
        args.max_results,
        member.user_id,
    );

    Success(SuccessResult { matches })
}
