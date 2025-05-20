use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::updates::c2c_invite_users::invite_users_to_community_impl;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_invite_users_to_channel::{Response::*, *};
use types::OCResult;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_invite_users_to_channel(args: Args) -> Response {
    execute_update(|state| c2c_invite_users_to_channel_impl(args, state)).unwrap_or_else(Error)
}

fn c2c_invite_users_to_channel_impl(args: Args, state: &mut RuntimeState) -> OCResult<Response> {
    state.data.verify_not_frozen()?;

    let member = state.data.members.get_verified_member(args.caller.into())?;

    let mut users_to_invite_to_channel = Vec::new();
    let mut users_to_invite_to_community = Vec::new();
    for (user_id, principal) in args.users {
        if state.data.members.get_by_user_id(&user_id).is_some() || state.data.invited_users.contains(&user_id) {
            users_to_invite_to_channel.push(user_id);
        } else {
            users_to_invite_to_community.push((user_id, principal));
        }
    }

    let mut failed_users = Vec::new();
    if !users_to_invite_to_community.is_empty() {
        if let Ok(result) = invite_users_to_community_impl(
            community_canister::c2c_invite_users::Args {
                users: users_to_invite_to_community.clone(),
                caller: args.caller,
            },
            state,
        ) {
            users_to_invite_to_channel.extend(result.invited_users);
        } else {
            failed_users.extend(users_to_invite_to_community.into_iter().map(|(u, _)| u))
        }
    }

    if users_to_invite_to_channel.is_empty() {
        return Ok(Failed(FailedResult { failed_users }));
    }

    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();
    let result = channel.chat.invite_users(member.user_id, users_to_invite_to_channel, now)?;
    let community_name = state.data.name.value.clone();
    let channel_name = channel.chat.name.value.clone();

    handle_activity_notification(state);

    Ok(if failed_users.is_empty() {
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
    })
}
