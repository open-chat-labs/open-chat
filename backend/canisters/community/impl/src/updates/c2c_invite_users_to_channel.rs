use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::updates::c2c_invite_users::invite_users_to_community_impl;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_bot_invite_users;
use community_canister::c2c_invite_users_to_channel::{Response::*, *};
use ic_principal::Principal;
use oc_error_codes::OCErrorCode;
use types::{BotCaller, BotPermissions, Caller, ChannelId, ChatPermission, OCResult, UserId};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_invite_users_to_channel(args: Args) -> Response {
    execute_update(|state| c2c_invite_users_to_channel_impl(args.channel_id, args.users, Caller::User(args.caller), state))
        .unwrap_or_else(Error)
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_invite_users(args: c2c_bot_invite_users::Args) -> Response {
    execute_update(|state| {
        c2c_invite_users_to_channel_impl(
            args.channel_id,
            args.users,
            Caller::BotV2(BotCaller {
                bot: args.bot_id,
                initiator: args.initiator.clone(),
            }),
            state,
        )
        .unwrap_or_else(Error)
    })
}

fn c2c_invite_users_to_channel_impl(
    channel_id: ChannelId,
    users: Vec<(UserId, Principal)>,
    ext_caller: Caller,
    state: &mut RuntimeState,
) -> OCResult<Response> {
    state.data.verify_not_frozen()?;

    if let Caller::BotV2(bot_caller) = &ext_caller {
        if !state.data.is_bot_permitted(
            &bot_caller.bot,
            Some(channel_id),
            &bot_caller.initiator,
            &BotPermissions::from_chat_permission(ChatPermission::InviteUsers),
        ) {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
    }

    let mut users_to_invite_to_channel = Vec::new();
    let mut users_to_invite_to_community = Vec::new();
    for (user_id, principal) in users {
        if state.data.members.get_by_user_id(&user_id).is_some() || state.data.invited_users.contains(&user_id) {
            users_to_invite_to_channel.push(user_id);
        } else {
            users_to_invite_to_community.push((user_id, principal));
        }
    }

    let mut failed_users = Vec::new();
    if !users_to_invite_to_community.is_empty() {
        if let Ok(result) = invite_users_to_community_impl(users_to_invite_to_community.clone(), ext_caller.clone(), state) {
            users_to_invite_to_channel.extend(result.invited_users);
        } else {
            failed_users.extend(users_to_invite_to_community.into_iter().map(|(u, _)| u))
        }
    }

    if users_to_invite_to_channel.is_empty() {
        return Ok(Failed(FailedResult { failed_users }));
    }

    let channel = state.data.channels.get_mut_or_err(&channel_id)?;
    let now = state.env.now();
    let result = channel.chat.invite_users(ext_caller, users_to_invite_to_channel, now)?;
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
