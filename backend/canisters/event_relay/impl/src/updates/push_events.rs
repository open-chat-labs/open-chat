use crate::guards::caller_can_push_events;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use event_relay_canister::push_events::Args as ArgsPrevious;
use event_relay_canister::push_events_v2::Args;
use event_store_canister::{Anonymizable, IdempotentEvent};
use event_store_producer::EventBuilder;
use ic_cdk_macros::update;

#[update(guard = "caller_can_push_events")]
#[trace]
fn push_events(args: ArgsPrevious) {
    mutate_state(|state| {
        push_events_impl(
            Args {
                events: args
                    .events
                    .into_iter()
                    .map(|e| IdempotentEvent {
                        idempotency_key: e.idempotency_key,
                        name: e.name,
                        timestamp: e.timestamp,
                        user: e
                            .user
                            .map(|u| Anonymizable::new(u.as_str().to_string(), Principal::from_text(u.as_str()).is_ok())),
                        source: e.source.map(|s| Anonymizable::new(s.as_str().to_string(), false)),
                        payload: e.payload,
                    })
                    .collect(),
            },
            state,
        )
    })
}

#[update(guard = "caller_can_push_events")]
#[trace]
fn push_events_v2(args: Args) {
    mutate_state(|state| push_events_impl(args, state))
}

fn push_events_impl(args: Args, state: &mut RuntimeState) {
    let now = state.env.now();

    state.data.event_store_client.push_many(
        args.events
            .into_iter()
            .filter(|e| state.data.event_deduper.try_push(e.idempotency_key, now))
            .map(|e| {
                EventBuilder::new(e.name, e.timestamp)
                    .with_maybe_user(
                        e.user.as_ref().map(|u| u.as_str().to_string()),
                        e.user.map(|u| !u.is_public()).unwrap_or_default(),
                    )
                    .with_maybe_source(
                        e.source.as_ref().map(|s| s.as_str().to_string()),
                        e.source.map(|s| !s.is_public()).unwrap_or_default(),
                    )
                    .with_payload(e.payload)
                    .build()
            }),
        true,
    );
}
