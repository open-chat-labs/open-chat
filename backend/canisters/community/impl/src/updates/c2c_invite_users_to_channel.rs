use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_invite_users_to_channel::{Response::*, *};
use group_chat_core::InvitedUsersResult;

#[update_msgpack(guard = "caller_is_local_user_index")]
#[trace]
fn c2c_invite_users_to_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_invite_users_to_channel_impl(args, state))
}

fn c2c_invite_users_to_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    if let Some(member) = state.data.members.get_by_user_id(&args.caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let (users_to_invite, users_not_in_community): (Vec<_>, Vec<_>) = args
            .user_ids
            .iter()
            .copied()
            .partition(|id| state.data.members.get_by_user_id(id).is_some());

        if users_to_invite.is_empty() {
            return Failed(FailedResult { users_not_in_community });
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();

            match channel.chat.invite_users(member.user_id, users_to_invite, now) {
                InvitedUsersResult::Success(result) => {
                    let community_name = state.data.name.clone();
                    let channel_name = channel.chat.name.clone();

                    if !channel.chat.is_public {
                        handle_activity_notification(state);
                    }

                    if users_not_in_community.is_empty() {
                        Success(SuccessResult {
                            invited_users: result.invited_users,
                            community_name,
                            channel_name,
                        })
                    } else {
                        PartialSuccess(PartialSuccessResult {
                            invited_users: result.invited_users,
                            community_name,
                            channel_name,
                            users_not_in_community,
                        })
                    }
                }
                InvitedUsersResult::UserNotInGroup => UserNotInChannel,
                InvitedUsersResult::NotAuthorized => NotAuthorized,
                InvitedUsersResult::UserSuspended => UserSuspended,
                InvitedUsersResult::TooManyInvites(v) => TooManyInvites(v),
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
