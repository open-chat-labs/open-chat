use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::CanisterId;
use user_canister::UserCanisterEvent;
use utils::canister::should_retry_failed_c2c_call;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.user_canister_events_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub(crate) fn try_run_now_for_canister(state: &mut RuntimeState, canister_id: CanisterId) -> bool {
    if let Some(events) = state.data.user_canister_events_queue.try_start_for_canister(canister_id) {
        if let Some(timer_id) = TIMER_ID.take() {
            ic_cdk_timers::clear_timer(timer_id);
        }
        ic_cdk::spawn(process_batch(vec![(canister_id, events)]));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'push_user_canister_events' running");
    TIMER_ID.set(None);

    if let Some(batch) = mutate_state(next_batch) {
        ic_cdk::spawn(process_batch(batch));
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<(CanisterId, Vec<UserCanisterEvent>)>> {
    state.data.user_canister_events_queue.try_start_batch()
}

async fn process_batch(batch: Vec<(CanisterId, Vec<UserCanisterEvent>)>) {
    let futures: Vec<_> = batch
        .into_iter()
        .map(|(canister_id, events)| push_events(canister_id, events))
        .collect();

    futures::future::join_all(futures).await;

    mutate_state(|state| {
        state.data.user_canister_events_queue.mark_batch_completed();
        start_job_if_required(state);
    });
}

async fn push_events(canister_id: CanisterId, events: Vec<UserCanisterEvent>) {
    let args = user_canister::c2c_notify_user_canister_events::Args { events: events.clone() };
    if let Err((code, msg)) = user_canister_c2c_client::c2c_notify_user_canister_events(canister_id, &args).await {
        if should_retry_failed_c2c_call(code, &msg) {
            mutate_state(|state| {
                // TODO remove this after next upgrade, it is just needed because at least 1 user
                // is stuck in an endless loop retrying sending an event to themselves
                if canister_id != state.env.canister_id() {
                    state
                        .data
                        .user_canister_events_queue
                        .requeue_failed_events(canister_id, events);
                }
            });
        }
    }
}
