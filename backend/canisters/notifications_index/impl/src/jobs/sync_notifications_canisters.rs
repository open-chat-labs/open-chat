use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use notifications_index_canister::NotificationsIndexEvent;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::CanisterId;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none())
        && (!state.data.notifications_index_event_sync_queue.is_empty()
            || state.data.notifications_index_event_sync_queue.sync_in_progress())
    {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'sync_notifications_canisters' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    if let Some(batch) = mutate_state(next_batch) {
        if !batch.is_empty() {
            ic_cdk::spawn(process_batch(batch));
        }
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'sync_notifications_canisters' job stopped");
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<(CanisterId, Vec<NotificationsIndexEvent>)>> {
    state.data.notifications_index_event_sync_queue.try_start_batch()
}

async fn process_batch(batch: Vec<(CanisterId, Vec<NotificationsIndexEvent>)>) {
    let futures: Vec<_> = batch
        .into_iter()
        .map(|(canister_id, events)| sync_events(canister_id, events))
        .collect();

    futures::future::join_all(futures).await;

    mutate_state(|state| state.data.notifications_index_event_sync_queue.mark_batch_completed());
}

async fn sync_events(canister_id: CanisterId, events: Vec<NotificationsIndexEvent>) {
    let args = notifications_canister::c2c_sync_index::Args { events: events.clone() };
    if notifications_canister_c2c_client::c2c_sync_index(canister_id, &args)
        .await
        .is_err()
    {
        mutate_state(|state| {
            state
                .data
                .notifications_index_event_sync_queue
                .mark_sync_failed_for_canister(canister_id, events);
        });
    }
}
