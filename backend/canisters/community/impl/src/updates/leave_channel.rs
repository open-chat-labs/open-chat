use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::leave_channel::{Response::*, *};
use group_chat_core::LeaveResult;
use ic_cdk_macros::update;

#[update]
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
    if let Some(member) = state.data.members.get_mut(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();

            match channel.chat.leave(member.user_id, now) {
                LeaveResult::Success(_) => {
                    member.leave(channel.id, now);
                    handle_activity_notification(state);
                    Success
                }
                LeaveResult::UserSuspended => UserSuspended,
                LeaveResult::LastOwnerCannotLeave => LastOwnerCannotLeave,
                LeaveResult::UserNotInGroup => UserNotInChannel,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
