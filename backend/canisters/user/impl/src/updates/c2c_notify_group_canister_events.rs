use crate::guards::caller_is_known_group_canister;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_group_canister_events::{Response::*, *};
use user_canister::GroupCanisterEvent;

#[update(guard = "caller_is_known_group_canister", msgpack = true)]
#[trace]
fn c2c_notify_group_canister_events(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_group_canister_events_impl(args, state))
}

fn c2c_notify_group_canister_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        process_event(event, state);
    }
    Success
}

fn process_event(event: GroupCanisterEvent, state: &mut RuntimeState) {
    let now = state.env.now();

    match event {
        GroupCanisterEvent::MessageActivity(event) => state.data.push_message_activity(event, now),
    }
}
