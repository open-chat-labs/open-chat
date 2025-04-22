use crate::queries::check_replica_up_to_date;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::thread_previews::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[query(msgpack = true)]
fn thread_previews(args: Args) -> Response {
    match read_state(|state| thread_previews_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn thread_previews_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    if let Err(now) = check_replica_up_to_date(args.latest_client_thread_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    let user_id = state.get_caller_user_id()?;
    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let now = state.env.now();
    let threads = channel.chat.thread_previews(user_id, args.threads)?;

    Ok(SuccessResult { threads, timestamp: now })
}
