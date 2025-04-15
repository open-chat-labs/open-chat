use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::events::CommunityEventInternal;
use crate::model::invited_users::UserInvitation;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_invite_users::{Response::*, *};
use itertools::Itertools;
use oc_error_codes::OCErrorCode;
use types::{OCResult, UsersInvited};

const MAX_INVITES: usize = 100;

#[update(guard = "caller_is_user_index_or_local_user_index", msgpack = true)]
#[trace]
fn c2c_invite_users(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| invite_users_to_community_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

pub(crate) fn invite_users_to_community_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    let member = state.data.members.get_verified_member(args.caller.into())?;
    let now = state.env.now();

    // The original caller must be authorized to invite other users
    if !member.role().can_invite_users(&state.data.permissions) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    // Filter out users who are already members and those who have already been invited
    let invited_users: Vec<_> = args
        .users
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
                    invited_by: member.user_id,
                    timestamp: now,
                },
            );
        }

        // Push a UsersInvited event
        state.data.events.push_event(
            CommunityEventInternal::UsersInvited(Box::new(UsersInvited {
                user_ids: user_ids.clone(),
                invited_by: member.user_id,
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
