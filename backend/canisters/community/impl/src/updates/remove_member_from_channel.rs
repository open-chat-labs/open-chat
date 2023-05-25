use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::remove_member_from_channel::{Response::*, *};
use group_chat_core::RemoveMemberResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn remove_member_from_channel(args: Args) -> Response {
    mutate_state(|state| remove_member_from_channel_impl(args, state))
}

fn remove_member_from_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if state.data.members.get(args.user_id.into()).is_none() {
            return TargetUserNotInCommunity;
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();
            match channel.chat.remove_member(member.user_id, args.user_id, false, now) {
                RemoveMemberResult::Success => Success,
                RemoveMemberResult::UserSuspended => UserSuspended,
                RemoveMemberResult::UserNotInGroup => UserNotInChannel,
                RemoveMemberResult::TargetUserNotInGroup => TargetUserNotInChannel,
                RemoveMemberResult::NotAuthorized => NotAuthorized,
                RemoveMemberResult::CannotRemoveSelf => CannotRemoveSelf,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
