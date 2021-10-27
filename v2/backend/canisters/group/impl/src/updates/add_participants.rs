use crate::updates::handle_activity_notification;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use candid::Principal;
use chat_events::ChatEventInternal;
use group_canister::add_participants::{Response::*, *};
use ic_cdk_macros::update;
use tracing::instrument;
use types::{EventIndex, MessageIndex, ParticipantsAdded, UserId};
use user_canister::c2c_try_add_to_group;

#[update]
#[instrument(level = "trace")]
async fn add_participants(args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = match RUNTIME_STATE.with(|state| prepare(&args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let mut users_added = Vec::new();
    let mut users_who_blocked_request = Vec::new();
    let mut errors = Vec::new();
    if !prepare_result.users_to_add.is_empty() {
        let c2c_args = c2c_try_add_to_group::Args {
            added_by: prepare_result.added_by,
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
                },
                Err(_) => {
                    errors.push(user_id);
                }
            }
        }
    }

    if !users_added.is_empty() {
        RUNTIME_STATE.with(|state| commit(prepare_result.added_by, &users_added, state.borrow_mut().as_mut().unwrap()));
    }

    if users_added.len() == args.user_ids.len() {
        Success
    } else {
        let mut failed_users = Vec::new();
        failed_users.extend(users_who_blocked_request.iter().cloned());
        failed_users.extend(errors.iter().cloned());

        if users_added.is_empty() {
            Failed(FailedResult {
                users_already_in_group: prepare_result.users_already_in_group,
                users_blocked_from_group: prepare_result.users_blocked_from_group,
                users_who_blocked_request,
                errors,
            })
        } else {
            PartialSuccess(PartialSuccessResult {
                users_added: users_added.into_iter().map(|(u, _)| u).collect(),
                users_already_in_group: prepare_result.users_already_in_group,
                users_blocked_from_group: prepare_result.users_blocked_from_group,
                users_who_blocked_request,
                errors,
            })
        }
    }
}

struct PrepareResult {
    added_by: UserId,
    users_to_add: Vec<UserId>,
    users_already_in_group: Vec<UserId>,
    users_blocked_from_group: Vec<UserId>,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if let Some(limit) = runtime_state
        .data
        .participants
        .user_limit_reached(runtime_state.data.is_public)
    {
        Err(ParticipantLimitReached(limit))
    } else if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let can_add_participants = participant.role.can_add_participants(runtime_state.data.is_public);
        if can_add_participants {
            let can_unblock_user = participant.role.can_unblock_user();
            let mut users_to_add = Vec::new();
            let mut users_already_in_group = Vec::new();
            let mut users_blocked_from_group = Vec::new();
            for user_id in args.user_ids.iter() {
                if !(args.allow_blocked_users && can_unblock_user) && runtime_state.data.participants.is_blocked(user_id) {
                    users_blocked_from_group.push(*user_id);
                } else if runtime_state.data.participants.get_by_user_id(user_id).is_none() {
                    users_to_add.push(*user_id);
                } else {
                    users_already_in_group.push(*user_id);
                }
            }
            Ok(PrepareResult {
                added_by: participant.user_id,
                users_to_add,
                users_already_in_group,
                users_blocked_from_group,
            })
        } else {
            Err(NotAuthorized)
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn commit(added_by: UserId, users: &[(UserId, Principal)], runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    let min_visible_event_index;
    let min_visible_message_index;
    if runtime_state.data.history_visible_to_new_joiners {
        min_visible_event_index = EventIndex::default();
        min_visible_message_index = MessageIndex::default();
    } else {
        min_visible_event_index = runtime_state.data.events.last().index.incr();
        min_visible_message_index = runtime_state.data.events.next_message_index();
    };

    for (user_id, principal) in users.iter().cloned() {
        runtime_state
            .data
            .participants
            .add(user_id, principal, now, min_visible_event_index, min_visible_message_index);

        // Ensure any users added are also unblocked
        runtime_state.data.participants.unblock(&user_id);
    }

    let event = ParticipantsAdded {
        user_ids: users.iter().map(|(u, _)| u).cloned().collect(),
        added_by,
    };
    runtime_state
        .data
        .events
        .push_event(ChatEventInternal::ParticipantsAdded(Box::new(event)), now);

    handle_activity_notification(runtime_state);
}
