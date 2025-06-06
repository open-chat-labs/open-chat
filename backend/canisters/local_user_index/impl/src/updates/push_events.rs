use crate::guards::caller_is_local_child_canister;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use local_user_index_canister::push_events::Args;

#[update(guard = "caller_is_local_child_canister")]
#[trace]
fn push_events(args: Args) {
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
