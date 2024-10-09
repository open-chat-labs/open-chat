use crate::guards::caller_is_known_community_canister;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_community_canister_events::{Response::*, *};
use user_canister::CommunityCanisterEvent;

#[update(guard = "caller_is_known_community_canister", msgpack = true)]
#[trace]
async fn c2c_notify_community_canister_events(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_community_canister_events_impl(args, state))
}

fn c2c_notify_community_canister_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        process_event(event, state);
    }
    Success
}

fn process_event(event: CommunityCanisterEvent, state: &mut RuntimeState) {
    let now = state.env.now();

    match event {
        CommunityCanisterEvent::MessageActivity(event) => state.data.message_activity_events.push(event, now),
    }
}
