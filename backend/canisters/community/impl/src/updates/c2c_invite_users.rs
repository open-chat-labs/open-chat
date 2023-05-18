use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::events::CommunityEvent;
use crate::model::invited_users::UserInvitation;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_invite_users::{Response::*, *};
use types::UsersInvited;

const MAX_INVITES: usize = 100;

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
fn c2c_invite_users(args: Args) -> Response {
    mutate_state(|state| c2c_invite_users_impl(args, state))
}

fn c2c_invite_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let now = state.env.now();

    if let Some(participant) = state.data.members.get(args.caller.into()) {
        // The original caller must be authorized to invite other users
        if participant.suspended.value || (!state.data.is_public && !participant.role.can_invite_users(&state.data.permissions))
        {
            return NotAuthorized;
        }

        // Filter out users who are already members and those who have already been invited
        let invited_users: Vec<_> = args
            .users
            .iter()
            .filter(|(_, principal)| {
                state.data.members.get(*principal).is_none() && !state.data.invited_users.contains(principal)
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
            for (user_id, principal) in invited_users.iter() {
                state.data.invited_users.add(
                    *principal,
                    UserInvitation {
                        invited: *user_id,
                        invited_by: participant.user_id,
                        timestamp: now,
                    },
                );
            }

            // Push a UsersInvited event
            state.data.events.push_event(
                CommunityEvent::UsersInvited(Box::new(UsersInvited {
                    user_ids: user_ids.clone(),
                    invited_by: participant.user_id,
                })),
                now,
            );
        }

        Success(SuccessResult {
            invited_users: user_ids,
            community_name: state.data.name.clone(),
        })
    } else {
        CallerNotInCommunity
    }
}
