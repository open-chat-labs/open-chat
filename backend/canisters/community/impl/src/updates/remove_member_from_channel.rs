use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_member_from_channel::{Response::*, *};
use group_chat_core::RemoveMemberResult;

#[update(candid = true, msgpack = true)]
#[trace]
fn remove_member_from_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| remove_member_from_channel_impl(args, state))
}

fn remove_member_from_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    let user_id = match state.data.members.get(caller) {
        Some(m) if m.suspended.value => return UserSuspended,
        Some(m) => m.user_id,
        _ => return UserNotInCommunity,
    };

    let target_member = match state.data.members.get_by_user_id_mut(&args.user_id) {
        Some(m) => m,
        _ => return TargetUserNotInCommunity,
    };

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();
        match channel.chat.remove_member(user_id, args.user_id, false, now) {
            RemoveMemberResult::Success => {
                target_member.leave(channel.id, now);
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
}
