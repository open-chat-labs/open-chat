use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::updates::c2c_invite_users::invite_users_to_community_impl;
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

    if let Some(member) = state.data.members.get_by_user_id(&args.caller).cloned() {
        if member.suspended.value {
            return UserSuspended;
        }

        let mut users_to_invite_to_channel = Vec::new();
        let mut users_to_invite_to_community = Vec::new();
        for (user_id, principal) in args.users {
            if state.data.members.get_by_user_id(&user_id).is_some() || state.data.invited_users.contains(&principal) {
                users_to_invite_to_channel.push(user_id);
            } else {
                users_to_invite_to_community.push((user_id, principal));
            }
        }

        let mut failed_users = Vec::new();

        if !users_to_invite_to_community.is_empty() {
            if let community_canister::c2c_invite_users::Response::Success(r) = invite_users_to_community_impl(
                community_canister::c2c_invite_users::Args {
                    users: users_to_invite_to_community.clone(),
                    caller: args.caller,
                },
                state,
            ) {
                users_to_invite_to_channel.extend(r.invited_users);
            } else {
                failed_users.extend(users_to_invite_to_community.into_iter().map(|(u, _)| u))
            }
        }

        if users_to_invite_to_channel.is_empty() {
            return Failed(FailedResult { failed_users });
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();

            match channel.chat.invite_users(member.user_id, users_to_invite_to_channel, now) {
                InvitedUsersResult::Success(result) => {
                    let community_name = state.data.name.clone();
                    let channel_name = channel.chat.name.clone();

                    handle_activity_notification(state);

                    if failed_users.is_empty() {
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
                            failed_users,
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
