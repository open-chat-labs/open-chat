use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update, jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::{c2c_bot_change_channel_role, change_channel_role::*};
use group_chat_core::GroupRoleInternal;
use group_community_common::ExpiringMember;
use oc_error_codes::{OCError, OCErrorCode};
use std::collections::HashMap;
use types::{BotCaller, BotPermissions, Caller, ChatPermission, GroupRole, OCResult, UserId};

#[update(msgpack = true)]
#[trace]
fn change_channel_role(args: Args) -> Response {
    change_channel_role_impl(args, None)
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_change_channel_role(args: c2c_bot_change_channel_role::Args) -> c2c_bot_change_channel_role::Response {
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };

    change_channel_role_impl(args.into(), Some(Caller::BotV2(bot_caller)))
}

fn change_channel_role_impl(args: Args, ext_caller: Option<Caller>) -> Response {
    match execute_update(|state| change_channel_role_inner(args, ext_caller, state)) {
        Ok(errors) => {
            if errors.is_empty() {
                Response::Success
            } else {
                Response::PartialSuccess(errors)
            }
        }
        Err(err) => Response::Error(err),
    }
}

fn change_channel_role_inner(
    mut args: Args,
    ext_caller: Option<Caller>,
    state: &mut RuntimeState,
) -> OCResult<HashMap<UserId, OCError>> {
    if args.user_ids.is_empty() {
        args.user_ids.push(args.user_id);
    }

    state.data.verify_not_frozen()?;

    let caller = state.verified_caller(ext_caller)?;

    // If caller is a bot then check bot permissions
    if let Caller::BotV2(bot_caller) = &caller
        && state.data.is_bot_permitted(
            &bot_caller.bot,
            Some(args.channel_id),
            &bot_caller.initiator,
            &BotPermissions::from_chat_permission(ChatPermission::ChangeRoles),
        )
    {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;

    // If caller is not a bot then check member permissions
    match &caller {
        Caller::BotV2(_) => {}
        _ => {
            let member = channel.chat.members.get_verified_member(caller.agent())?;
            if !member
                .role()
                .can_change_roles(args.new_role.into(), &channel.chat.permissions)
            {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
        }
    }

    let now = state.env.now();
    let results = channel.chat.change_role(caller.agent(), args.user_ids, args.new_role, now);

    // Owners can't "lapse" so either add or remove user from expiry list if they lose or gain owner status
    if let Some(gate_expiry) = channel.chat.gate_config.value.as_ref().and_then(|gc| gc.expiry()) {
        for (user_id, prev_role) in results.users.iter().filter_map(|(user_id, result)| match result {
            Ok(role) => Some((*user_id, *role)),
            Err(_) => None,
        }) {
            if matches!(args.new_role, GroupRole::Owner) {
                state.data.expiring_members.remove_member(user_id, None);
            } else if matches!(prev_role, GroupRoleInternal::Owner) {
                state.data.expiring_members.push(ExpiringMember {
                    expires: now + gate_expiry,
                    channel_id: Some(args.channel_id),
                    user_id,
                });
            }
        }
    }

    jobs::expire_members::start_job_if_required(state);

    state.push_bot_notification(results.bot_notification);
    handle_activity_notification(state);

    Ok(results
        .users
        .into_iter()
        .filter_map(|(user_id, result)| match result {
            Ok(_) => None,
            Err(err) => Some((user_id, err)),
        })
        .collect())
}
