use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, AddParticipantArgs, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::add_participants::{Response::*, *};
use ic_cdk_macros::update;
use types::{AddedToGroupNotification, EventIndex, MessageIndex, Notification, ParticipantsAdded, UserId};
use user_canister::c2c_try_add_to_group;

#[update]
#[trace]
async fn add_participants(args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return *response,
    };

    let mut users_added = Vec::new();
    let mut users_who_blocked_request = Vec::new();
    let mut users_suspended = Vec::new();
    let mut errors = Vec::new();
    if !prepare_result.users_to_add.is_empty() {
        let c2c_args = c2c_try_add_to_group::Args {
            added_by: prepare_result.added_by,
            latest_message_index: prepare_result.latest_message_index,
        };
        let futures: Vec<_> = prepare_result
            .users_to_add
            .iter()
            .cloned()
            .map(|u| user_canister_c2c_client::c2c_try_add_to_group(u.into(), &c2c_args))
            .collect();

        let responses = futures::future::join_all(futures).await;

        for (index, response) in responses.into_iter().enumerate() {
            let user_id = *prepare_result.users_to_add.get(index).unwrap();
            match response {
                Ok(result) => match result {
                    c2c_try_add_to_group::Response::Success(r) => users_added.push((user_id, r.principal)),
                    c2c_try_add_to_group::Response::Blocked => users_who_blocked_request.push(user_id),
                    c2c_try_add_to_group::Response::UserSuspended => users_suspended.push(user_id),
                },
                Err(_) => {
                    errors.push(user_id);
                }
            }
        }
    }

    if !users_added.is_empty() {
        let added_by_name = args.added_by_name;
        mutate_state(|state| {
            commit(
                prepare_result.added_by,
                added_by_name,
                &users_added,
                args.correlation_id,
                state,
            )
        });
    }

    if users_added.len() == args.user_ids.len() {
        Success
    } else if users_added.is_empty() {
        Failed(FailedResult {
            users_already_in_group: prepare_result.users_already_in_group,
            users_blocked_from_group: prepare_result.users_blocked_from_group,
            users_who_blocked_request,
            users_suspended,
            errors,
        })
    } else {
        PartialSuccess(PartialSuccessResult {
            users_added: users_added.into_iter().map(|(u, _)| u).collect(),
            users_already_in_group: prepare_result.users_already_in_group,
            users_blocked_from_group: prepare_result.users_blocked_from_group,
            users_who_blocked_request,
            users_not_authorized_to_add: prepare_result.users_not_authorized_to_add,
            users_suspended,
            errors,
        })
    }
}

struct PrepareResult {
    added_by: UserId,
    latest_message_index: Option<MessageIndex>,
    users_to_add: Vec<UserId>,
    users_already_in_group: Vec<UserId>,
    users_blocked_from_group: Vec<UserId>,
    users_not_authorized_to_add: Vec<UserId>,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Box<Response>> {
    if runtime_state.data.is_frozen() {
        return Err(Box::new(ChatFrozen));
    }

    let caller = runtime_state.env.caller();
    if let Some(limit) = runtime_state.data.participants.user_limit_reached() {
        Err(Box::new(ParticipantLimitReached(limit)))
    } else if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.suspended.value {
            return Err(Box::new(UserSuspended));
        }

        let permissions = &runtime_state.data.permissions;
        let can_add_participants = participant.role.can_add_members(permissions, runtime_state.data.is_public);
        let can_unblock_users = args.allow_blocked_users && participant.role.can_block_users(permissions);

        if !can_add_participants && !can_unblock_users {
            return Err(Box::new(NotAuthorized));
        }

        let mut users_to_add = Vec::new();
        let mut users_already_in_group = Vec::new();
        let mut users_blocked_from_group = Vec::new();
        let mut users_not_authorized_to_add = Vec::new();
        for user_id in args.user_ids.iter() {
            if runtime_state.data.participants.get_by_user_id(user_id).is_some() {
                users_already_in_group.push(*user_id);
            } else if runtime_state.data.participants.is_blocked(user_id) {
                if can_unblock_users {
                    users_to_add.push(*user_id);
                } else {
                    users_blocked_from_group.push(*user_id);
                }
            } else if !can_add_participants {
                users_not_authorized_to_add.push(*user_id);
            } else {
                users_to_add.push(*user_id);
            }
        }

        if users_not_authorized_to_add.len() == args.user_ids.len() {
            return Err(Box::new(NotAuthorized));
        }

        let now = runtime_state.env.now();

        Ok(PrepareResult {
            added_by: participant.user_id,
            latest_message_index: runtime_state.data.events.main_events_reader(now).latest_message_index(),
            users_to_add,
            users_already_in_group,
            users_blocked_from_group,
            users_not_authorized_to_add,
        })
    } else {
        Err(Box::new(CallerNotInGroup))
    }
}

fn commit(
    added_by: UserId,
    added_by_name: String,
    users: &[(UserId, Principal)],
    correlation_id: u64,
    runtime_state: &mut RuntimeState,
) {
    let now = runtime_state.env.now();
    let mut min_visible_event_index = EventIndex::default();
    let mut min_visible_message_index = MessageIndex::default();
    if !runtime_state.data.history_visible_to_new_joiners {
        // If there is only an initial "group created" event then allow these initial
        // participants to see the "group created" event by starting min_visible_* at zero
        let events_reader = runtime_state.data.events.main_events_reader(now);
        if events_reader.len() > 1 {
            min_visible_event_index = events_reader.next_event_index();
            min_visible_message_index = events_reader.next_message_index();
        }
    };

    let mut unblocked = vec![];

    for (user_id, principal) in users.iter().copied() {
        // Ensure any users added are first unblocked
        if runtime_state.data.participants.unblock(&user_id) {
            unblocked.push(user_id);
        }

        runtime_state.add_participant(AddParticipantArgs {
            user_id,
            principal,
            now,
            min_visible_event_index,
            min_visible_message_index,
            mute_notifications: runtime_state.data.is_public,
        });
    }

    let user_ids: Vec<_> = users.iter().map(|(u, _)| u).copied().collect();
    let event = ParticipantsAdded {
        user_ids: user_ids.clone(),
        added_by,
        unblocked,
    };
    runtime_state
        .data
        .events
        .push_main_event(ChatEventInternal::ParticipantsAdded(Box::new(event)), correlation_id, now);

    handle_activity_notification(runtime_state);

    let notification = Notification::AddedToGroupNotification(AddedToGroupNotification {
        chat_id: runtime_state.env.canister_id().into(),
        group_name: runtime_state.data.name.clone(),
        added_by,
        added_by_name,
        timestamp: now,
    });
    runtime_state.push_notification(user_ids, notification);
}
