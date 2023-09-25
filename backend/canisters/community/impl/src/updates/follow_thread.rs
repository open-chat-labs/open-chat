use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::follow_thread::{Response::*, *};
use group_chat_core::FollowThreadResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn follow_thread(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| follow_thread_impl(args, state))
}

fn follow_thread_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    let now = state.env.now();

    let user_id = match state.data.members.get(caller) {
        Some(member) if member.suspended.value => return UserSuspended,
        Some(member) => member.user_id,
        None => return UserNotInCommunity,
    };

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        match channel.chat.follow_thread(user_id, args.thread_root_message_index, now) {
            FollowThreadResult::Success => {
                state.data.mark_community_updated_in_user_canister(user_id);
                Success
            }
            FollowThreadResult::AlreadyFollowing => AlreadyFollowing,
            FollowThreadResult::ThreadNotFound => ThreadNotFound,
            FollowThreadResult::UserNotInGroup => UserNotInChannel,
            FollowThreadResult::UserSuspended => UserSuspended,
        }
    } else {
        ChannelNotFound
    }
}
