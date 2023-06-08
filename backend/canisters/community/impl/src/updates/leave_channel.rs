use crate::{activity_notifications::handle_activity_notification, mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::leave_channel::{Response::*, *};
use group_chat_core::LeaveResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn leave_channel(args: Args) -> Response {
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
            match channel.chat.leave(member.user_id, state.env.now()) {
                LeaveResult::Success => {
                    member.channels.remove(&args.channel_id);
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
