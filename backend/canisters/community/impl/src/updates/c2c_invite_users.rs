use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::events::CommunityEventInternal;
use crate::model::invited_users::UserInvitation;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_invite_users::{Response::*, *};
use types::UsersInvited;

const MAX_INVITES: usize = 100;

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
fn c2c_invite_users(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| invite_users_to_community_impl(args, state))
}

pub(crate) fn invite_users_to_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let now = state.env.now();

    if let Some(member) = state.data.members.get_by_user_id(&args.caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        // The original caller must be authorized to invite other users
        if !state.data.is_public && !member.role.can_invite_users(&state.data.permissions) {
            return NotAuthorized;
        }

        // Filter out users who are already members and those who have already been invited
        let invited_users: Vec<_> = args
            .users
            .iter()
            .filter(|(user_id, principal)| {
                state.data.members.get(*principal).is_none() && !state.data.invited_users.contains(user_id)
            })
            .copied()
            .collect();

        let user_ids: Vec<_> = invited_users.iter().map(|(user_id, _)| user_id).copied().collect();

        if !state.data.is_public {
            // Check the max invite limit will not be exceeded
            if state.data.invited_users.len() + invited_users.len() > MAX_INVITES {
                return TooManyInvites(MAX_INVITES as u32);
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
        }

        for (user_id, principal) in invited_users.iter() {
            state.data.members.add_user_id(*principal, *user_id);
        }

        Success(SuccessResult {
            invited_users: user_ids,
            community_name: state.data.name.clone(),
        })
    } else {
        UserNotInCommunity
    }
}
