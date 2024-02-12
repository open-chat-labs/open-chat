use crate::guards::caller_can_push_events;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use event_relay_canister::push_events::*;
use event_sink_canister::Event;
use ic_cdk_macros::update;

#[update(guard = "caller_can_push_events")]
#[trace]
fn push_events(args: Args) {
    mutate_state(|state| push_events_impl(args, state))
}

fn push_events_impl(args: Args, state: &mut RuntimeState) {
    let now = state.env.now();

    for event in args.events {
        if state.data.event_deduper.try_push(event.idempotency_key, now) {
            let user = event.user.map(|u| state.data.obfuscate_user(u));

            state.data.events_sink_client.push_event(Event {
                name: event.name,
                timestamp: event.timestamp,
                user,
                source: event.source,
                payload: event.payload,
            });
        }
    }
}
