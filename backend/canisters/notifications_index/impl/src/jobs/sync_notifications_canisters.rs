use crate::{mutate_state, RuntimeState};
use ic_cdk::timer::TimerId;
use notifications_index_canister::NotificationsIndexEvent;
use std::cell::Cell;
use std::time::Duration;
use types::CanisterId;

const MAX_BATCH_SIZE: usize = 1000;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none())
        && runtime_state
            .data
            .notifications_canisters
            .values()
            .any(|c| c.sync_in_progress() || c.queue_len() > 0)
    {
        let timer_id = ic_cdk::timer::set_timer_interval(Duration::default(), run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        true
    } else {
        false
    }
}

fn run() {
    if let Some(batches) = mutate_state(get_next) {
        if !batches.is_empty() {
            ic_cdk::spawn(process_batches(batches));
        }
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk::timer::clear_timer(timer_id);
    }
}

fn get_next(runtime_state: &mut RuntimeState) -> Option<Vec<(CanisterId, Vec<NotificationsIndexEvent>)>> {
    let any_pending = runtime_state
        .data
        .notifications_canisters
        .values()
        .any(|c| c.sync_in_progress() || c.queue_len() > 0);

    if any_pending {
        let now = runtime_state.env.now();

        Some(
            runtime_state
                .data
                .notifications_canisters
                .iter_mut()
                .filter(|(_, c)| !c.sync_in_progress() && c.queue_len() > 0)
                .map(|(id, c)| {
                    let mut batch = Vec::new();
                    while let Some(next) = c.take_next() {
                        batch.push(next);
                        if batch.len() == MAX_BATCH_SIZE {
                            break;
                        }
                    }
                    c.mark_sync_in_progress(now);

                    (*id, batch)
                })
                .collect(),
        )
    } else {
        None
    }
}

async fn process_batches(batches: Vec<(CanisterId, Vec<NotificationsIndexEvent>)>) {
    let futures: Vec<_> = batches.into_iter().map(|(c, e)| process_batch(c, e)).collect();

    futures::future::join_all(futures).await;
}

async fn process_batch(canister_id: CanisterId, events: Vec<NotificationsIndexEvent>) {
    let args = notifications_canister::c2c_sync_index::Args { events };

    match notifications_canister_c2c_client::c2c_sync_index(canister_id, &args).await {
        Ok(_) => mutate_state(|state| {
            if let Some(canister) = state.data.notifications_canisters.get_mut(&canister_id) {
                canister.mark_sync_complete();
            }
        }),
        Err(_) => mutate_state(|state| {
            if let Some(canister) = state.data.notifications_canisters.get_mut(&canister_id) {
                for event in args.events.into_iter().rev() {
                    canister.enqueue_event_front(event);
                }
                canister.mark_sync_complete();
            }
        }),
    }
}
