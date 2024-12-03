use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_canister::thread_previews::{Response::*, *};
use group_chat_core::ThreadPreviewsResult;

#[query(msgpack = true)]
fn thread_previews(args: Args) -> Response {
    read_state(|state| thread_previews_impl(args, state))
}

fn thread_previews_impl(args: Args, state: &RuntimeState) -> Response {
    if let Err(now) = check_replica_up_to_date(args.latest_client_thread_update, state) {
        return ReplicaNotUpToDate(now);
    }

    let caller = state.env.caller();

    if let Some(user_id) = state.data.lookup_user_id(caller) {
        let now = state.env.now();

        match state.data.chat.thread_previews(user_id, args.threads) {
            ThreadPreviewsResult::Success(threads) => Success(SuccessResult { threads, timestamp: now }),
            ThreadPreviewsResult::UserNotInGroup => CallerNotInGroup,
        }
    } else {
        CallerNotInGroup
    }
}
