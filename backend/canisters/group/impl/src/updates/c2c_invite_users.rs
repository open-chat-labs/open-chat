use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::invited_users::UserInvitation;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::c2c_invite_users::{Response::*, *};
use types::{EventIndex, MessageIndex, UsersInvited};

const MAX_INVITES: usize = 100;

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
fn c2c_invite_users(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_invite_users_impl(args, state))
}

fn c2c_invite_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let now = state.env.now();

    if let Some(member) = state.data.chat.members.get(&args.caller) {
        // The original caller must be authorized to invite other users
        if member.suspended.value || (!state.data.chat.is_public && !member.role.can_invite_users(&state.data.chat.permissions))
        {
            return NotAuthorized;
        }

        // Filter out users who are already members and those who have already been invited
        let invited_users: Vec<_> = args
            .users
            .iter()
            .filter(|(user_id, principal)| {
                state.data.chat.members.get(user_id).is_none() && !state.data.invited_users.contains(principal)
            })
            .copied()
            .collect();

        let user_ids: Vec<_> = invited_users.iter().map(|(user_id, _)| user_id).copied().collect();

        if !state.data.chat.is_public {
            // Check the max invite limit will not be exceeded
            if state.data.invited_users.len() + invited_users.len() > MAX_INVITES {
                return TooManyInvites(MAX_INVITES as u32);
            }

            // Find the latest event and message that the invited users are allowed to see
            let mut min_visible_event_index = EventIndex::default();
            let mut min_visible_message_index = MessageIndex::default();
            if !state.data.chat.history_visible_to_new_joiners {
                // If there is only an initial "group created" event then allow these users
                // to see the "group created" event by starting min_visible_* at zero
                let events_reader = state.data.chat.events.main_events_reader(now);
                if events_reader.len() > 1 {
                    min_visible_event_index = events_reader.next_event_index();
                    min_visible_message_index = events_reader.next_message_index();
                }
            };

            // Add new invites
            for (user_id, principal) in invited_users.iter() {
                state.data.invited_users.add(
                    *principal,
                    UserInvitation {
                        invited: *user_id,
                        invited_by: member.user_id,
                        timestamp: now,
                        min_visible_event_index,
                        min_visible_message_index,
                    },
                );
            }

            // Push a UsersInvited event
            state.data.chat.events.push_main_event(
                ChatEventInternal::UsersInvited(Box::new(UsersInvited {
                    user_ids: user_ids.clone(),
                    invited_by: member.user_id,
                })),
                args.correlation_id,
                now,
            );
            handle_activity_notification(state);
        }

        Success(SuccessResult {
            invited_users: user_ids,
            group_name: state.data.chat.name.clone(),
        })
    } else {
        CallerNotInGroup
    }
}
