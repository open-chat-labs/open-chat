use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::remove_member_from_channel::{Response::*, *};
use group_chat_core::RemoveMemberResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn remove_member_from_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| remove_member_from_channel_impl(args, state))
}

fn remove_member_from_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let target_user_in_community = state.data.members.get_by_user_id(&args.user_id).is_some();

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get_mut(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if !target_user_in_community {
            return TargetUserNotInCommunity;
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();
            match channel.chat.remove_member(member.user_id, args.user_id, false, now) {
                RemoveMemberResult::Success => {
                    member.channels.remove(&args.channel_id);
                    handle_activity_notification(state);
                    Success
                }
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
