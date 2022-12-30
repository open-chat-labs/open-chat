use crate::{mutate_state, RuntimeState};
use ic_cdk_macros::heartbeat;
use notifications_index_canister::NotificationsIndexEvent;
use types::{CanisterId, Version};
use utils::canister::{upgrade, FailedUpgrade};

#[heartbeat]
fn heartbeat() {
    upgrade_canisters::run();
    sync_notifications_canisters::run();
}

mod upgrade_canisters {
    use super::*;
    type CanisterToUpgrade = utils::canister::CanisterToUpgrade<notifications_canister::post_upgrade::Args>;

    pub fn run() {
        if let Some(canister_to_upgrade) = mutate_state(try_get_next) {
            ic_cdk::spawn(perform_upgrade(canister_to_upgrade));
        }
    }

    fn try_get_next(runtime_state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        if runtime_state.data.canisters_requiring_upgrade.count_in_progress() > 0 {
            return None;
        }

        let canister_id = runtime_state.data.canisters_requiring_upgrade.try_take_next()?;

        let current_wasm_version = match runtime_state.data.notifications_canisters.get(&canister_id) {
            Some(canister) => canister.wasm_version(),
            None => {
                runtime_state.data.canisters_requiring_upgrade.mark_skipped(&canister_id);
                return None;
            }
        };

        let new_wasm = runtime_state.data.notifications_canister_wasm.clone();
        let wasm_version = new_wasm.version;

        Some(CanisterToUpgrade {
            canister_id,
            current_wasm_version,
            new_wasm,
            deposit_cycles_if_needed: false,
            args: notifications_canister::post_upgrade::Args { wasm_version },
        })
    }

    async fn perform_upgrade(canister_to_upgrade: CanisterToUpgrade) {
        let canister_id = canister_to_upgrade.canister_id;
        let from_version = canister_to_upgrade.current_wasm_version;
        let to_version = canister_to_upgrade.new_wasm.version;

        match upgrade(canister_to_upgrade).await {
            Ok(_) => {
                mutate_state(|state| on_success(canister_id, to_version, state));
            }
            Err(_) => {
                mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
            }
        }
    }

    fn on_success(canister_id: CanisterId, to_version: Version, runtime_state: &mut RuntimeState) {
        if let Some(canister) = runtime_state.data.notifications_canisters.get_mut(&canister_id) {
            canister.set_wasm_version(to_version);
        }

        runtime_state.data.canisters_requiring_upgrade.mark_success(&canister_id);
    }

    fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, runtime_state: &mut RuntimeState) {
        runtime_state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
            canister_id,
            from_version,
            to_version,
        });
    }
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
