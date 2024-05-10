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
    if TIMER_ID.get().is_none() && !state.data.user_index_event_sync_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub(crate) fn try_run_now(state: &mut RuntimeState) -> bool {
    if let Some((canister_id, events)) = next_batch(state) {
        if let Some(timer_id) = TIMER_ID.take() {
            ic_cdk_timers::clear_timer(timer_id);
        }
        ic_cdk::spawn(sync_events(canister_id, events));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'sync_events_to_user_index_canister' job running");
    TIMER_ID.set(None);

    if let Some((canister_id, events)) = mutate_state(next_batch) {
        ic_cdk::spawn(sync_events(canister_id, events));
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<(CanisterId, Vec<UserIndexEvent>)> {
    state.data.user_index_event_sync_queue.try_start_single()
}

async fn sync_events(canister_id: CanisterId, events: Vec<UserIndexEvent>) {
    let args = user_index_canister::c2c_notify_events::Args { events: events.clone() };
    let success = user_index_canister_c2c_client::c2c_notify_events(canister_id, &args)
        .await
        .is_ok();

    mutate_state(|state| {
        if !success {
            state
                .data
                .user_index_event_sync_queue
                .requeue_failed_events(canister_id, events);
        }
        state.data.user_index_event_sync_queue.mark_batch_completed();
        start_job_if_required(state);
    });
}
