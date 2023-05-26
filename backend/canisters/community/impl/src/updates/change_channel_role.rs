use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::change_channel_role::{Response::*, *};
use group_members::ChangeRoleResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn change_channel_role(args: Args) -> Response {
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
                ChangeRoleResult::Success(_) => Success,
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
