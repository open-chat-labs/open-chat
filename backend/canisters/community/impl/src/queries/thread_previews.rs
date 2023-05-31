use crate::{read_state, RuntimeState};
use community_canister::thread_previews::{Response::*, *};
use group_chat_core::ThreadPreviewsResult;
use ic_cdk_macros::query;

#[query]
fn thread_previews(args: Args) -> Response {
    read_state(|state| thread_previews_impl(args, state))
}

fn thread_previews_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(member) = state.data.members.get(caller) {
        let user_id = member.user_id;

        if let Some(channel) = state.data.channels.get(&args.channel_id) {
            let now = state.env.now();

            match channel
                .chat
                .thread_previews(user_id, args.threads, args.latest_client_thread_update, now)
            {
                ThreadPreviewsResult::Success(threads) => Success(SuccessResult { threads, timestamp: now }),
                ThreadPreviewsResult::UserNotInGroup => UserNotInChannel,
                ThreadPreviewsResult::ReplicaNotUpToDate(t) => ReplicaNotUpToDate(t),
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
