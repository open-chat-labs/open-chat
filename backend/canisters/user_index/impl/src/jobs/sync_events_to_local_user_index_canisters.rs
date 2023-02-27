use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use local_user_index_canister::Event as LocalUserIndexEvent;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::CanisterId;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !runtime_state.data.user_index_event_sync_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::from_secs(10), run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'sync_events_to_local_user_index_canisters' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    match mutate_state(try_get_next) {
        GetNextResult::Success(batch) => {
            ic_cdk::spawn(process_batch(batch));
        }
        GetNextResult::Continue => {}
        GetNextResult::QueueEmpty => {
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("'sync_events_to_local_user_index_canisters' job stopped");
            }
        }
    }
}

enum GetNextResult {
    Success(Vec<(CanisterId, Vec<LocalUserIndexEvent>)>),
    Continue,
    QueueEmpty,
}

fn try_get_next(runtime_state: &mut RuntimeState) -> GetNextResult {
    if runtime_state.data.user_index_event_sync_queue.is_empty() {
        GetNextResult::QueueEmpty
    } else if let Some(batch) = runtime_state.data.user_index_event_sync_queue.try_start_batch() {
        GetNextResult::Success(batch)
    } else {
        GetNextResult::Continue
    }
}

async fn process_batch(batch: Vec<(CanisterId, Vec<LocalUserIndexEvent>)>) {
    let futures: Vec<_> = batch
        .into_iter()
        .map(|(canister_id, events)| sync_events(canister_id, events))
        .collect();

    futures::future::join_all(futures).await;

    mutate_state(|state| state.data.user_index_event_sync_queue.mark_batch_completed());
}

async fn sync_events(canister_id: CanisterId, events: Vec<LocalUserIndexEvent>) {
    let args = local_user_index_canister::c2c_notify_user_index_events::Args { events: events.clone() };
    if local_user_index_canister_c2c_client::c2c_notify_user_index_events(canister_id, &args)
        .await
        .is_err()
    {
        mutate_state(|state| {
            state
                .data
                .user_index_event_sync_queue
                .mark_sync_failed_for_canister(canister_id, events);

            start_job_if_required(state);
        });
    }
}
