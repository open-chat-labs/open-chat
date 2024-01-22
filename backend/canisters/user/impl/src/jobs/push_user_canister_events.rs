use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::CanisterId;
use user_canister::UserCanisterEvent;
use utils::canister_timers::run_now_then_interval;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.user_canister_events_queue.is_empty() {
        let timer_id = run_now_then_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'push_user_canister_events' job started");
        true
    } else {
        false
    }
}

fn run() {
    match mutate_state(next_batch) {
        NextBatchResult::Success(batch) => ic_cdk::spawn(process_batch(batch)),
        NextBatchResult::Continue => {}
        NextBatchResult::QueueEmpty => {
            if let Some(timer_id) = TIMER_ID.take() {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("'push_user_canister_events' job stopped");
            }
        }
    }
}

enum NextBatchResult {
    Success(Vec<(CanisterId, Vec<UserCanisterEvent>)>),
    Continue,
    QueueEmpty,
}

fn next_batch(state: &mut RuntimeState) -> NextBatchResult {
    if let Some(batch) = state.data.user_canister_events_queue.try_start_batch() {
        NextBatchResult::Success(batch)
    } else if !state.data.user_canister_events_queue.is_empty() || state.data.user_canister_events_queue.sync_in_progress() {
        NextBatchResult::Continue
    } else {
        NextBatchResult::QueueEmpty
    }
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
    if user_canister_c2c_client::c2c_notify_user_canister_events(canister_id, &args)
        .await
        .is_err()
    {
        mutate_state(|state| {
            state
                .data
                .user_canister_events_queue
                .mark_sync_failed_for_canister(canister_id, events);
        });
    }
}
