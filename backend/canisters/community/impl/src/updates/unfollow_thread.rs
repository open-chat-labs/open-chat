use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::unfollow_thread::{Response::*, *};
use group_chat_core::UnfollowThreadResult;

#[update(msgpack = true)]
#[trace]
fn unfollow_thread(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| unfollow_thread_impl(args, state))
}

fn unfollow_thread_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    let now = state.env.now();

    let user_id = match state.data.members.get(caller) {
        Some(member) if member.suspended().value => return UserSuspended,
        Some(member) if member.lapsed().value => return UserLapsed,
        Some(member) => member.user_id,
        None => return UserNotInCommunity,
    };

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        match channel.chat.unfollow_thread(user_id, args.thread_root_message_index, now) {
            UnfollowThreadResult::Success => {
                state.data.mark_community_updated_in_user_canister(user_id);
                Success
            }
            UnfollowThreadResult::NotFollowing => NotFollowing,
            UnfollowThreadResult::ThreadNotFound => ThreadNotFound,
            UnfollowThreadResult::UserNotInGroup => UserNotInChannel,
            UnfollowThreadResult::UserSuspended => UserSuspended,
            UnfollowThreadResult::UserLapsed => UserLapsed,
        }
    } else {
        ChannelNotFound
    }
}
