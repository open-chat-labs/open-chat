use crate::guards::caller_is_local_group_or_community_canister;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use event_store_canister::{Anonymizable, IdempotentEvent};
use ic_cdk_macros::update;
use local_group_index_canister::push_events::Args as ArgsPrevious;
use local_group_index_canister::push_events_v2::Args;

#[update(guard = "caller_is_local_group_or_community_canister")]
#[trace]
fn push_events(args: ArgsPrevious) {
    mutate_state(|state| {
        push_events_impl(
            Args {
                events: args
                    .events
                    .into_iter()
                    .filter(|e| e.name != "message_sent")
                    .map(|e| IdempotentEvent {
                        idempotency_key: e.idempotency_key,
                        name: e.name,
                        timestamp: e.timestamp,
                        user: e.user.map(|u| Anonymizable::new(u, true)),
                        source: e.source.map(|s| Anonymizable::new(s, true)),
                        payload: e.payload,
                    })
                    .collect(),
            },
            state,
        )
    })
}

#[update(guard = "caller_is_local_group_or_community_canister")]
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
            .map(|e| e.into()),
        true,
    );
}
