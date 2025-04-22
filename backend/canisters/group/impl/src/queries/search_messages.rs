use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use group_canister::search_messages::{Response::*, *};
use types::OCResult;

#[query(msgpack = true)]
fn search_messages(args: Args) -> Response {
    match read_state(|state| search_messages_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn search_messages_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let user_id = state.get_caller_user_id()?;
    let matches = state
        .data
        .chat
        .search(user_id, args.search_term, args.users, args.max_results)?;

    Ok(SuccessResult { matches })
}
