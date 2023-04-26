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

fn c2c_invite_users_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let now = runtime_state.env.now();

    if let Some(participant) = runtime_state.data.participants.get_by_user_id(&args.caller) {
        // The original caller must be authorized to invite other users
        if participant.suspended.value
            || (!runtime_state.data.is_public && !participant.role.can_invite_users(&runtime_state.data.permissions))
        {
            return NotAuthorized;
        }

        // Filter out users who are already members
        let invited_users: Vec<_> = args
            .users
            .iter()
            .filter(|(_, principal)| runtime_state.data.participants.get_by_principal(principal).is_none())
            .copied()
            .collect();

        let user_ids: Vec<_> = invited_users.iter().map(|(user_id, _)| user_id).copied().collect();

        if !runtime_state.data.is_public {
            // Check the max invite limit will not be exceeded
            if runtime_state.data.invited_users.len() + invited_users.len() > MAX_INVITES {
                return TooManyInvites(MAX_INVITES as u32);
            }

            // Find the latest event and message that the invited users are allowed to see
            let mut min_visible_event_index = EventIndex::default();
            let mut min_visible_message_index = MessageIndex::default();
            if !runtime_state.data.history_visible_to_new_joiners {
                // If there is only an initial "group created" event then allow these users
                // to see the "group created" event by starting min_visible_* at zero
                let events_reader = runtime_state.data.events.main_events_reader(now);
                if events_reader.len() > 1 {
                    min_visible_event_index = events_reader.next_event_index();
                    min_visible_message_index = events_reader.next_message_index();
                }
            };

            // Add new invites and update any existing invites
            for (user_id, principal) in invited_users.iter() {
                runtime_state.data.invited_users.insert(
                    *user_id,
                    *principal,
                    UserInvitation {
                        timestamp: now,
                        invited_by: participant.user_id,
                        min_visible_event_index,
                        min_visible_message_index,
                    },
                );
            }

            // Push a UsersInvited event
            runtime_state.data.events.push_main_event(
                ChatEventInternal::UsersInvited(Box::new(UsersInvited {
                    user_ids: user_ids.clone(),
                    invited_by: participant.user_id,
                })),
                args.correlation_id,
                now,
            );
            handle_activity_notification(runtime_state);
        }

        Success(SuccessResult {
            invited_users: user_ids,
            group_name: runtime_state.data.name.clone(),
        })
    } else {
        CallerNotInGroup
    }
}
