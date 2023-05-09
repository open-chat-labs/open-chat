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

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none())
        && (!runtime_state.data.user_event_sync_queue.is_empty() || runtime_state.data.user_event_sync_queue.sync_in_progress())
    {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'sync_events_to_user_canisters' job started");
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
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("'sync_events_to_user_canisters' job stopped");
            }
        }
    }
}

enum NextBatchResult {
    Success(Vec<(CanisterId, Vec<UserEvent>)>),
    Continue,
    QueueEmpty,
}

fn next_batch(runtime_state: &mut RuntimeState) -> NextBatchResult {
    if let Some(batch) = runtime_state.data.user_event_sync_queue.try_start_batch() {
        NextBatchResult::Success(batch)
    } else if !runtime_state.data.user_event_sync_queue.is_empty()
        || runtime_state.data.user_event_sync_queue.sync_in_progress()
    {
        NextBatchResult::Continue
    } else {
        NextBatchResult::QueueEmpty
    }
}

async fn process_batch(batch: Vec<(CanisterId, Vec<UserEvent>)>) {
    let futures: Vec<_> = batch
        .into_iter()
        .map(|(canister_id, events)| sync_events(canister_id, events))
        .collect();

    futures::future::join_all(futures).await;

    mutate_state(|state| state.data.user_event_sync_queue.mark_batch_completed());
}

async fn sync_events(canister_id: CanisterId, events: Vec<UserEvent>) {
    let args = user_canister::c2c_notify_user_events::Args { events: events.clone() };
    if user_canister_c2c_client::c2c_notify_events(canister_id, &args).await.is_err() {
        mutate_state(|state| {
            state
                .data
                .user_event_sync_queue
                .mark_sync_failed_for_canister(canister_id, events);
        });
    }
}
