use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::CanisterId;
use user_index_canister::Event as UserIndexEvent;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none())
        && (!state.data.user_index_event_sync_queue.is_empty() || state.data.user_index_event_sync_queue.sync_in_progress())
    {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'sync_events_to_user_index_canister' job started");
        true
    } else {
        false
    }
}

fn run() {
    match mutate_state(next_batch) {
        NextBatchResult::Success(canister_id, events) => ic_cdk::spawn(sync_events(canister_id, events)),
        NextBatchResult::Continue => {}
        NextBatchResult::QueueEmpty => {
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("'sync_events_to_user_index_canister' job stopped");
            }
        }
    }
}

enum NextBatchResult {
    Success(CanisterId, Vec<UserIndexEvent>),
    Continue,
    QueueEmpty,
}

fn next_batch(state: &mut RuntimeState) -> NextBatchResult {
    if let Some((user_index_canister_id, events)) = state.data.user_index_event_sync_queue.try_start_single() {
        NextBatchResult::Success(user_index_canister_id, events)
    } else if !state.data.user_index_event_sync_queue.is_empty() || state.data.user_index_event_sync_queue.sync_in_progress() {
        NextBatchResult::Continue
    } else {
        NextBatchResult::QueueEmpty
    }
}

async fn sync_events(canister_id: CanisterId, events: Vec<UserIndexEvent>) {
    let args = user_index_canister::c2c_notify_events::Args { events: events.clone() };
    if user_index_canister_c2c_client::c2c_notify_events(canister_id, &args)
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

    mutate_state(|state| state.data.user_index_event_sync_queue.mark_batch_completed());
}
