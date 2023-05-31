use crate::{read_state, RuntimeState};
use group_canister::thread_previews::{Response::*, *};
use group_chat_core::ThreadPreviewsResult;
use ic_cdk_macros::query;

#[query]
fn thread_previews(args: Args) -> Response {
    read_state(|state| thread_previews_impl(args, state))
}

fn thread_previews_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(user_id) = state.data.lookup_user_id(&caller) {
        let now = state.env.now();

        match state
            .data
            .chat
            .thread_previews(user_id, args.threads, args.latest_client_thread_update, now)
        {
            ThreadPreviewsResult::Success(threads) => Success(SuccessResult { threads, timestamp: now }),
            ThreadPreviewsResult::UserNotInGroup => CallerNotInGroup,
            ThreadPreviewsResult::ReplicaNotUpToDate(t) => ReplicaNotUpToDate(t),
        }
    } else {
        CallerNotInGroup
    }
}
