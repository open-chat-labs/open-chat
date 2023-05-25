use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::leave_channel::{Response::*, *};
use group_chat_core::LeaveGroupResult;
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
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            match channel.chat.leave_group(member.user_id, state.env.now()) {
                LeaveGroupResult::Success => Success,
                LeaveGroupResult::UserSuspended => UserSuspended,
                LeaveGroupResult::LastOwnerCannotLeave => LastOwnerCannotLeave,
                LeaveGroupResult::UserNotInGroup => UserNotInChannel,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
