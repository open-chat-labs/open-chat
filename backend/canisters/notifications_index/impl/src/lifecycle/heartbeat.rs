use crate::{mutate_state, RuntimeState};
use ic_cdk_macros::heartbeat;
use notifications_index_canister::NotificationsIndexEvent;
use types::CanisterId;

#[heartbeat]
fn heartbeat() {
    sync_notifications_canisters::run();
    cycles_dispenser_client::run();
}

mod sync_notifications_canisters {
    use super::*;

    const MAX_BATCH_SIZE: usize = 1000;

    pub fn run() {
        let batches = mutate_state(get_next);
        if !batches.is_empty() {
            ic_cdk::spawn(process_batches(batches));
        }
    }

    fn get_next(runtime_state: &mut RuntimeState) -> Vec<(CanisterId, Vec<NotificationsIndexEvent>)> {
        let now = runtime_state.env.now();

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
            .collect()
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
}
