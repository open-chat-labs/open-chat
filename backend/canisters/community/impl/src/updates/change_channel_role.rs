use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::change_channel_role::{Response::*, *};
use group_chat_core::{ChangeRoleResult, GroupRoleInternal};
use group_community_common::ExpiringMember;
use types::GroupRole;

#[update(candid = true, msgpack = true)]
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
        if member.suspended().value {
            return UserSuspended;
        } else if member.lapsed().value {
            return UserLapsed;
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();

            match channel
                .chat
                .change_role(member.user_id, args.user_id, args.new_role, false, false, now)
            {
                ChangeRoleResult::Success(result) => {
                    // Owners can't "lapse" so either add or remove user from expiry list if they lose or gain owner status
                    if let Some(gate_expiry) = channel.chat.gate_config.value.as_ref().and_then(|gc| gc.expiry()) {
                        if matches!(args.new_role, GroupRole::Owner) {
                            state.data.expiring_members.remove_member(args.user_id, Some(args.channel_id));
                        } else if matches!(result.prev_role, GroupRoleInternal::Owner) {
                            state.data.expiring_members.push(ExpiringMember {
                                expires: now + gate_expiry,
                                channel_id: Some(args.channel_id),
                                user_id: args.user_id,
                            });
                        }
                    }

                    handle_activity_notification(state);
                    Success
                }
                ChangeRoleResult::UserNotInGroup => UserNotInChannel,
                ChangeRoleResult::NotAuthorized => NotAuthorized,
                ChangeRoleResult::TargetUserNotInGroup => TargetUserNotInChannel,
                ChangeRoleResult::Unchanged => Success,
                ChangeRoleResult::Invalid => Invalid,
                ChangeRoleResult::UserSuspended => UserSuspended,
                ChangeRoleResult::UserLapsed => UserLapsed,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
