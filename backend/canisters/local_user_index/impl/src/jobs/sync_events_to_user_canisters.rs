use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::CanisterId;
use user_canister::Event as UserEvent;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.user_event_sync_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub(crate) fn try_run_now(state: &mut RuntimeState) -> bool {
    if let Some(batch) = next_batch(state) {
        if let Some(timer_id) = TIMER_ID.take() {
            ic_cdk_timers::clear_timer(timer_id);
        }
        ic_cdk::spawn(process_batch(batch));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'sync_events_to_user_canisters' job running");
    TIMER_ID.set(None);

    if let Some(batch) = mutate_state(next_batch) {
        ic_cdk::spawn(process_batch(batch));
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<(CanisterId, Vec<UserEvent>)>> {
    state.data.user_event_sync_queue.try_start_batch()
}

async fn process_batch(batch: Vec<(CanisterId, Vec<UserEvent>)>) {
    let futures: Vec<_> = batch
        .into_iter()
        .map(|(canister_id, events)| sync_events(canister_id, events))
        .collect();

    futures::future::join_all(futures).await;

    mutate_state(|state| {
        state.data.user_event_sync_queue.mark_batch_completed();
        start_job_if_required(state);
    });
}

async fn sync_events(canister_id: CanisterId, events: Vec<UserEvent>) {
    let args = user_canister::c2c_notify_events::Args { events: events.clone() };
    if user_canister_c2c_client::c2c_notify_events(canister_id, &args).await.is_err() {
        mutate_state(|state| {
            state
                .data
                .user_event_sync_queue
                .mark_sync_failed_for_canister(canister_id, events);
        });
    }
}
