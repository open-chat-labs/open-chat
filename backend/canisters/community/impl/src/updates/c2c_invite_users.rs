use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::events::CommunityEventInternal;
use crate::model::invited_users::UserInvitation;
use crate::{RuntimeState, execute_update};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_invite_users::{Response::*, *};
use itertools::Itertools;
use oc_error_codes::OCErrorCode;
use types::{BotPermissions, Caller, CommunityPermission, OCResult, UserId, UsersInvited};

const MAX_INVITES: usize = 100;

#[update(guard = "caller_is_user_index_or_local_user_index", msgpack = true)]
#[trace]
fn c2c_invite_users(args: Args) -> Response {
    match execute_update(|state| invite_users_to_community_impl(args.users, Caller::User(args.caller), state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

pub(crate) fn invite_users_to_community_impl(
    users: Vec<(UserId, Principal)>,
    caller: Caller,
    state: &mut RuntimeState,
) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    if let Caller::BotV2(bot_caller) = &caller {
        if !state.data.is_bot_permitted(
            &bot_caller.bot,
            None,
            &bot_caller.initiator,
            &BotPermissions::from_community_permission(CommunityPermission::InviteUsers),
        ) {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
    }

    let invited_by = if let Some(initiator) = caller.initiator() {
        let member = state.data.members.get_verified_member(*initiator)?;
        if !member.role().can_invite_users(&state.data.permissions) {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
        initiator
    } else {
        caller.agent()
    };

    let now = state.env.now();

    // Filter out users who are already members and those who have already been invited
    let invited_users: Vec<_> = users
        .iter()
        .unique_by(|(u, _)| u)
        .filter(|(user_id, principal)| {
            state.data.members.get(*principal).is_none()
                && !state.data.invited_users.contains(user_id)
                && !state.data.members.is_blocked(user_id)
        })
        .copied()
        .collect();

    let user_ids: Vec<_> = invited_users.iter().map(|(user_id, _)| user_id).copied().collect();

    if !user_ids.is_empty() {
        // Check the max invite limit will not be exceeded
        if state.data.invited_users.len() + invited_users.len() > MAX_INVITES {
            return Err(OCErrorCode::TooManyInvites.with_message(MAX_INVITES));
        }

        // Add new invites
        for user_id in user_ids.iter().copied() {
            state.data.invited_users.add(
                user_id,
                UserInvitation {
                    invited_by,
                    timestamp: now,
                },
            );
        }

        // Push a UsersInvited event
        state.data.events.push_event(
            CommunityEventInternal::UsersInvited(Box::new(UsersInvited {
                user_ids: user_ids.clone(),
                invited_by,
            })),
            now,
        );

        handle_activity_notification(state);

        for (user_id, principal) in invited_users.iter() {
            state.data.members.add_user_id(*principal, *user_id);
        }
    }

    Ok(SuccessResult {
        invited_users: user_ids,
        community_name: state.data.name.value.clone(),
    })
}
