use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use community_canister::search_channel::{Response::*, *};
use types::OCResult;

#[query(msgpack = true)]
fn search_channel(args: Args) -> Response {
    match read_state(|state| search_channel_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn search_channel_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let user_id = state.get_caller_user_id()?;
    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let matches = channel.chat.search(user_id, args.search_term, args.users, args.max_results)?;

    Ok(SuccessResult { matches })
}
