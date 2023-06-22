use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use community_canister::change_channel_role::{Response::*, *};
use group_chat_core::ChangeRoleResult;

#[update_candid_and_msgpack]
#[trace]
fn change_channel_role(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| change_channel_role_impl(args, state))
}

fn change_channel_role_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();

            match channel
                .chat
                .change_role(member.user_id, args.user_id, args.new_role, false, false, now)
            {
                ChangeRoleResult::Success(_) => {
                    handle_activity_notification(state);
                    Success
                }
                ChangeRoleResult::UserNotInGroup => UserNotInChannel,
                ChangeRoleResult::NotAuthorized => NotAuthorized,
                ChangeRoleResult::TargetUserNotInGroup => TargetUserNotInChannel,
                ChangeRoleResult::Unchanged => Success,
                ChangeRoleResult::Invalid => Invalid,
                ChangeRoleResult::UserSuspended => UserSuspended,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
