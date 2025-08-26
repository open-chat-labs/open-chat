use crate::{
    RuntimeState, activity_notifications::handle_activity_notification, execute_update_async,
    guards::caller_is_local_user_index, model::events::CommunityEventInternal, mutate_state, read_state,
    updates::remove_member_from_channel::remove_member_from_channel_impl,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_member::*;
use fire_and_forget_handler::FireAndForgetHandler;
use local_user_index_canister_c2c_client::lookup_user;
use msgpack::serialize_then_unwrap;
use oc_error_codes::OCErrorCode;
use std::collections::HashMap;
use types::{
    BotCaller, BotPermissions, Caller, CanisterId, ChatPermission, CommunityMembersRemoved, CommunityPermission, CommunityRole,
    CommunityUsersBlocked, OCResult, UnitResult, UserId,
};
use user_canister::c2c_remove_from_community;

#[update(msgpack = true)]
#[trace]
async fn block_user(args: community_canister::block_user::Args) -> UnitResult {
    execute_update_async(|| remove_member_impl(args.user_id, true, None)).await
}

#[update(msgpack = true)]
#[trace]
async fn remove_member(args: Args) -> UnitResult {
    execute_update_async(|| remove_member_impl(args.user_id, false, None)).await
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
async fn c2c_bot_remove_user(args: community_canister::c2c_bot_remove_user::Args) -> UnitResult {
    execute_update_async(|| c2c_bot_remove_user_impl(args)).await
}

async fn c2c_bot_remove_user_impl(args: community_canister::c2c_bot_remove_user::Args) -> UnitResult {
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };

    if !read_state(|state| {
        let required_permissions = if args.channel_id.is_some() {
            BotPermissions::from_chat_permission(ChatPermission::RemoveMembers)
        } else {
            BotPermissions::from_community_permission(CommunityPermission::RemoveMembers)
        };

        state
            .data
            .is_bot_permitted(&bot_caller.bot, args.channel_id, &bot_caller.initiator, &required_permissions)
    }) {
        return OCErrorCode::InitiatorNotAuthorized.into();
    }

    if let Some(channel_id) = args.channel_id {
        mutate_state(|state| remove_member_from_channel_impl(channel_id, args.user_id, Some(Caller::BotV2(bot_caller)), state))
            .into()
    } else {
        remove_member_impl(args.user_id, args.block, Some(Caller::BotV2(bot_caller))).await
    }
}

async fn remove_member_impl(user_id: UserId, block: bool, ext_caller: Option<Caller>) -> UnitResult {
    // Check the caller can remove the user
    let prepare_result = match read_state(|state| prepare(user_id, block, ext_caller, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    // If the user is an owner of the community then call the local_user_index
    // to check whether they are a "platform moderator" in which case this removal
    // is not authorized
    if prepare_result.is_user_to_remove_an_owner {
        match lookup_user(user_id.into(), prepare_result.local_user_index_canister_id).await {
            Ok(Some(user)) if !user.is_platform_moderator => (),
            Ok(_) => return Response::Error(OCErrorCode::InitiatorNotAuthorized.into()),
            Err(error) => return Response::Error(error.into()),
        }
    }

    // Remove the user from the community
    mutate_state(|state| commit(user_id, block, prepare_result.removed_by, state));

    Response::Success
}

struct PrepareResult {
    removed_by: UserId,
    local_user_index_canister_id: CanisterId,
    is_user_to_remove_an_owner: bool,
}

fn prepare(user_id: UserId, block: bool, ext_caller: Option<Caller>, state: &RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_frozen()?;

    if block && !state.data.is_public.value {
        return Err(OCErrorCode::CommunityNotPublic.into());
    }

    let caller = state.verified_caller(ext_caller)?;
    let agent = caller.agent();

    if agent == user_id {
        Err(OCErrorCode::CannotRemoveSelf.into())
    } else {
        let user_to_remove_role = match state.data.members.get_by_user_id(&user_id) {
            Some(member_to_remove) => member_to_remove.role(),
            None => {
                if !state.data.invited_users.contains(&user_id) && (!block || state.data.members.is_blocked(&user_id)) {
                    return Err(OCErrorCode::NoChange.into());
                }
                CommunityRole::Member // We still want to remove an invite and/or block the user
            }
        };

        // Check if the caller is authorized to remove the user
        if let Some(initiator) = caller.initiator() {
            let member = state.data.members.get_verified_member(*initiator)?;
            if !member
                .role()
                .can_remove_members_with_role(user_to_remove_role, &state.data.permissions)
            {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
        }

        Ok(PrepareResult {
            removed_by: agent,
            local_user_index_canister_id: state.data.local_user_index_canister_id,
            is_user_to_remove_an_owner: user_to_remove_role.is_owner(),
        })
    }
}

fn commit(user_id: UserId, block: bool, removed_by: UserId, state: &mut RuntimeState) {
    let now = state.env.now();

    // Remove the user from the community
    let removed_member = state.data.remove_user_from_community(user_id, None, now);
    let removed = removed_member.is_some();

    let blocked = block && state.data.members.block(user_id, now);

    let referred_by = removed_member
        .and_then(|r| r.referred_by)
        .map_or(HashMap::new(), |referred_by| HashMap::from_iter([(user_id, referred_by)]));

    let invite_removed = state.data.invited_users.remove(&user_id, now).is_some();

    // Push relevant event
    let event = if blocked {
        let event = CommunityUsersBlocked {
            user_ids: vec![user_id],
            blocked_by: removed_by,
            referred_by,
        };
        Some(CommunityEventInternal::UsersBlocked(Box::new(event)))
    } else if removed {
        let event = CommunityMembersRemoved {
            user_ids: vec![user_id],
            removed_by,
            referred_by,
        };
        Some(CommunityEventInternal::MembersRemoved(Box::new(event)))
    } else if invite_removed {
        None
    } else {
        return;
    };

    if let Some(event) = event {
        state.push_community_event(event);
    }

    handle_activity_notification(state);

    if removed {
        // Fire-and-forget call to notify the user canister
        remove_membership_from_user_canister(
            user_id,
            removed_by,
            block,
            state.data.name.value.clone(),
            state.data.is_public.value,
            &mut state.data.fire_and_forget_handler,
        );
    }
}

fn remove_membership_from_user_canister(
    user_id: UserId,
    removed_by: UserId,
    blocked: bool,
    community_name: String,
    public: bool,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    let args = c2c_remove_from_community::Args {
        removed_by,
        blocked,
        community_name,
        public,
    };
    fire_and_forget_handler.send(
        user_id.into(),
        "c2c_remove_from_community_msgpack".to_string(),
        serialize_then_unwrap(args),
    );
}
