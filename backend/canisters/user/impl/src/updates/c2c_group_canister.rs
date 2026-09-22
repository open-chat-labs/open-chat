use crate::guards::caller_is_known_group_canister;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::IdempotentEnvelope;
use user_canister::GroupCanisterEvent;
use user_canister::c2c_group_canister::*;

#[update(guard = "caller_is_known_group_canister", msgpack = true)]
#[trace]
fn c2c_group_canister(args: Args) -> Response {
    execute_update(|state| handle_events(args.events, state))
}

pub(crate) fn handle_events(events: Vec<IdempotentEnvelope<GroupCanisterEvent>>, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let mut awarded_achievement = false;

    for event in events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            match event.value {
                GroupCanisterEvent::MessageActivity(event) => state.data.user.push_message_activity(event, now),
                GroupCanisterEvent::Achievement(achievement) => {
                    awarded_achievement |= state.data.user.award_achievement(achievement, now);
                }
            }
        }
    }

    if awarded_achievement {
        state.notify_user_index_of_chit(now);
    }

    Response::Success
}
