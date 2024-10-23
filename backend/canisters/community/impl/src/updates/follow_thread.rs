use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::follow_thread::{Response::*, *};
use group_chat_core::FollowThreadResult;
use types::Achievement;

#[update(candid = true, msgpack = true)]
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

    let (user_id, is_bot) = match state.data.members.get(caller) {
        Some(member) if member.suspended.value => return UserSuspended,
        Some(member) if member.lapsed.value => return UserLapsed,
        Some(member) => (member.user_id, member.user_type.is_bot()),
        None => return UserNotInCommunity,
    };

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        match channel.chat.follow_thread(user_id, args.thread_root_message_index, now) {
            FollowThreadResult::Success => {
                if args.new_achievement && !is_bot {
                    state.data.notify_user_of_achievement(user_id, Achievement::FollowedThread);
                }

                state.data.mark_community_updated_in_user_canister(user_id);
                Success
            }
            FollowThreadResult::AlreadyFollowing => AlreadyFollowing,
            FollowThreadResult::ThreadNotFound => ThreadNotFound,
            FollowThreadResult::UserNotInGroup => UserNotInChannel,
            FollowThreadResult::UserSuspended => UserSuspended,
            FollowThreadResult::UserLapsed => UserLapsed,
        }
    } else {
        ChannelNotFound
    }
}
