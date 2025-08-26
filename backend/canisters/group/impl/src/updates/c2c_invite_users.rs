use crate::activity_notifications::handle_activity_notification;
use crate::guards::{caller_is_local_user_index, caller_is_user_index_or_local_user_index};
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_bot_invite_users;
use group_canister::c2c_invite_users::{Response::*, *};
use ic_principal::Principal;
use oc_error_codes::OCErrorCode;
use types::{BotCaller, BotPermissions, Caller, ChatPermission, OCResult, UserId};

#[update(guard = "caller_is_user_index_or_local_user_index", msgpack = true)]
#[trace]
fn c2c_invite_users(args: Args) -> Response {
    match execute_update(|state| c2c_invite_users_impl(args.users, Caller::User(args.caller), state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_invite_users(args: c2c_bot_invite_users::Args) -> Response {
    match execute_update(|state| c2c_bot_invite_users_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn c2c_bot_invite_users_impl(args: c2c_bot_invite_users::Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };

    if !state.data.is_bot_permitted(
        &bot_caller.bot,
        &bot_caller.initiator,
        &BotPermissions::from_chat_permission(ChatPermission::InviteUsers),
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    c2c_invite_users_impl(args.users, Caller::BotV2(bot_caller), state)
}

fn c2c_invite_users_impl(
    users: Vec<(UserId, Principal)>,
    ext_caller: Caller,
    state: &mut RuntimeState,
) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    let now = state.env.now();
    let result = state.data.invite_users(ext_caller, users, now)?;

    if !state.data.chat.is_public.value {
        handle_activity_notification(state);
    }

    Ok(SuccessResult {
        invited_users: result.invited_users,
        group_name: result.group_name,
    })
}
