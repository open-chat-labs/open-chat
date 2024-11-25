use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::leave_channel::{Response::*, *};
use group_chat_core::LeaveResult;

#[update(candid = true, msgpack = true)]
#[trace]
fn leave_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| leave_channel_impl(args, state))
}

fn leave_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    let Some(member) = state.data.members.get_mut(caller) else {
        return UserNotInCommunity;
    };

    if member.suspended().value {
        return UserSuspended;
    }

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return ChannelNotFound;
    };

    let now = state.env.now();
    let user_id = member.user_id;

    match channel.chat.leave(user_id, now) {
        LeaveResult::Success(_) => {
            state.data.remove_user_from_channel(user_id, args.channel_id, now);
            handle_activity_notification(state);
            Success
        }
        LeaveResult::UserSuspended => UserSuspended,
        LeaveResult::LastOwnerCannotLeave => LastOwnerCannotLeave,
        LeaveResult::UserNotInGroup => UserNotInChannel,
    }
}
