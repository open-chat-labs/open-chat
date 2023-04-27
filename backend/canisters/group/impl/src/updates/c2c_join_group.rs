use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::participants::AddResult;
use crate::{mutate_state, read_state, run_regular_jobs, AddParticipantArgs, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use gated_groups::{check_if_passes_gate, CheckIfPassesGateResult};
use group_canister::c2c_join_group::{Response::*, *};
use types::{CanisterId, EventIndex, GroupGate, MessageIndex, ParticipantJoined, UsersUnblocked};

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
async fn c2c_join_group(args: Args) -> Response {
    run_regular_jobs();

    match read_state(|state| is_permitted_to_join(args.principal, state)) {
        Ok(Some((gate, user_index_canister_id))) => {
            match check_if_passes_gate(gate, args.user_id, user_index_canister_id).await {
                CheckIfPassesGateResult::Success => {}
                CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
                CheckIfPassesGateResult::InternalError(error) => return InternalError(error),
            }
        }
        Ok(None) => {}
        Err(response) => return response,
    };

    mutate_state(|state| c2c_join_group_impl(args, state))
}

fn is_permitted_to_join(
    user_principal: Principal,
    runtime_state: &RuntimeState,
) -> Result<Option<(GroupGate, CanisterId)>, Response> {
    let caller = runtime_state.env.caller();

    // If the call is from the user index then we skip the checks
    if caller == runtime_state.data.user_index_canister_id {
        Ok(None)
    } else if runtime_state.data.is_frozen() {
        Err(ChatFrozen)
    } else if !runtime_state.data.is_accessible_by_non_member(user_principal) {
        Err(NotInvited)
    } else if let Some(limit) = runtime_state.data.participants.user_limit_reached() {
        Err(ParticipantLimitReached(limit))
    } else {
        Ok(runtime_state
            .data
            .gate
            .as_ref()
            .map(|g| (g.clone(), runtime_state.data.user_index_canister_id)))
    }
}

fn c2c_join_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let min_visible_event_index;
    let min_visible_message_index;
    if runtime_state.data.history_visible_to_new_joiners {
        min_visible_event_index = EventIndex::default();
        min_visible_message_index = MessageIndex::default();
    } else {
        let events_reader = runtime_state.data.events.main_events_reader(now);
        min_visible_event_index = events_reader.next_event_index();
        min_visible_message_index = events_reader.next_message_index();
    };

    // Unblock "platform moderator" if necessary
    let mut new_event = false;
    if args.is_platform_moderator && runtime_state.data.participants.is_blocked(&args.user_id) {
        runtime_state.data.participants.unblock(&args.user_id);

        let event = UsersUnblocked {
            user_ids: vec![args.user_id],
            unblocked_by: args.user_id,
        };

        runtime_state
            .data
            .events
            .push_main_event(ChatEventInternal::UsersUnblocked(Box::new(event)), args.correlation_id, now);

        new_event = true;
    }

    let response = match runtime_state.add_participant(AddParticipantArgs {
        user_id: args.user_id,
        principal: args.principal,
        now,
        min_visible_event_index,
        min_visible_message_index,
        mute_notifications: runtime_state.data.is_public,
    }) {
        AddResult::Success(participant) => {
            let invitation = runtime_state.data.invited_users.remove(&args.user_id, now);

            let event = ParticipantJoined {
                user_id: args.user_id,
                invited_by: invitation.map(|i| i.invited_by),
            };
            runtime_state.data.events.push_main_event(
                ChatEventInternal::ParticipantJoined(Box::new(event)),
                args.correlation_id,
                now,
            );

            new_event = true;

            let summary = runtime_state.summary(&participant, now);
            Success(Box::new(summary))
        }
        AddResult::AlreadyInGroup => {
            let participant = runtime_state.data.participants.get_by_principal(&args.principal).unwrap();
            let summary = runtime_state.summary(participant, now);
            AlreadyInGroupV2(Box::new(summary))
        }
        AddResult::Blocked => Blocked,
    };

    if new_event {
        handle_activity_notification(runtime_state);
    }

    response
}
