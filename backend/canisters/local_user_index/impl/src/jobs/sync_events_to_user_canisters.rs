use crate::{mutate_state, RuntimeState};
use ic_cdk::timer::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, UserEvent};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none())
        && (!runtime_state.data.user_event_sync_queue.is_empty() || runtime_state.data.user_event_sync_queue.sync_in_progress())
    {
        let timer_id = ic_cdk::timer::set_timer_interval(Duration::default(), run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        info!("'sync_events_to_user_canisters' job started");
        true
    } else {
        false
    }
}

fn run() {
    match mutate_state(next_batch) {
        NextBatchResult::Success(batch) => {
            for (canister_id, events) in batch {
                ic_cdk::spawn(sync_events(canister_id, events));
            }
        }
        NextBatchResult::Continue => {}
        NextBatchResult::QueueEmpty => {
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk::timer::clear_timer(timer_id);
                info!("'sync_events_to_user_canisters' job stopped");
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
    if let Some(batch) = runtime_state.data.user_event_sync_queue.try_start_sync() {
        NextBatchResult::Success(batch)
    } else if !runtime_state.data.user_event_sync_queue.is_empty()
        || runtime_state.data.user_event_sync_queue.sync_in_progress()
    {
        NextBatchResult::Continue
    } else {
        NextBatchResult::QueueEmpty
    }
}

async fn sync_events(canister_id: CanisterId, events: Vec<UserEvent>) {
    let args = user_canister::c2c_notify_user_events::Args { events: events.clone() };
    match user_canister_c2c_client::c2c_notify_user_events(canister_id, &args).await {
        Ok(_) => mutate_state(on_success),
        Err(_) => mutate_state(|state| on_failure(canister_id, events, state)),
    }
}

fn on_success(runtime_state: &mut RuntimeState) {
    runtime_state.data.user_event_sync_queue.mark_sync_completed();
}

fn on_failure(canister_id: CanisterId, events: Vec<UserEvent>, runtime_state: &mut RuntimeState) {
    runtime_state.data.user_event_sync_queue.mark_sync_failed(canister_id, events);
}
