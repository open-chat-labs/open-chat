use crate::{mutate_state, RuntimeState};
use ic_cdk::heartbeat;
use storage_bucket_canister::c2c_sync_index::{Args, Response, SuccessResult};
use types::{BuildVersion, CanisterId};

const MAX_CONCURRENT_CANISTER_UPGRADES: usize = 1;

#[heartbeat]
fn heartbeat() {
    sync_buckets::run();
    upgrade_canisters::run();
}

mod sync_buckets {
    use super::*;
    use crate::updates::c2c_notify_low_balance::top_up_cycles;
    use utils::cycles::is_out_of_cycles_error;

    pub fn run() {
        for (canister_id, args) in mutate_state(next_batch) {
            ic_cdk::spawn(send_to_bucket(canister_id, args));
        }
    }

    fn next_batch(state: &mut RuntimeState) -> Vec<(CanisterId, Args)> {
        state.data.buckets.pop_args_for_next_sync()
    }

    async fn send_to_bucket(canister_id: CanisterId, args: Args) {
        match storage_bucket_canister_c2c_client::c2c_sync_index(canister_id, &args).await {
            Ok(Response::Success(result)) => {
                mutate_state(|state| handle_success(canister_id, result, state));
            }
            Err((code, msg)) => {
                if is_out_of_cycles_error(code, &msg) {
                    // Canister is out of cycles
                    top_up_cycles(Some(canister_id)).await;
                }
                mutate_state(|state| handle_error(canister_id, args, state));
            }
        }
    }

    fn handle_success(canister_id: CanisterId, result: SuccessResult, state: &mut RuntimeState) {
        for file in result.files_removed {
            state.data.remove_file_reference(canister_id, file);
        }

        if let Some(bucket) = state.data.buckets.get_mut(&canister_id) {
            bucket.sync_state.mark_sync_completed();
        }
    }

    fn handle_error(canister_id: CanisterId, args: Args, state: &mut RuntimeState) {
        if let Some(bucket) = state.data.buckets.get_mut(&canister_id) {
            bucket.sync_state.mark_sync_failed(args);
        }
    }
}

mod upgrade_canisters {
    use super::*;
    use ic_cdk::api::management_canister::main::CanisterInstallMode;
    use utils::canister::{FailedUpgrade, WasmToInstall};

    type CanisterToUpgrade = utils::canister::CanisterToInstall<storage_bucket_canister::post_upgrade::Args>;

    pub fn run() {
        let canisters_to_upgrade = mutate_state(next_batch);
        if !canisters_to_upgrade.is_empty() {
            ic_cdk::spawn(perform_upgrades(canisters_to_upgrade));
        }
    }

    fn next_batch(state: &mut RuntimeState) -> Vec<CanisterToUpgrade> {
        let count_in_progress = state.data.canisters_requiring_upgrade.count_in_progress();
        (0..(MAX_CONCURRENT_CANISTER_UPGRADES - count_in_progress))
            .map_while(|_| try_get_next(state))
            .collect()
    }

    fn try_get_next(state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        let (canister_id, _) = state.data.canisters_requiring_upgrade.try_take_next()?;
        let bucket = state.data.buckets.get(&canister_id)?;
        let new_wasm = state.data.bucket_canister_wasm.clone();
        let wasm_version = new_wasm.version;

        Some(CanisterToUpgrade {
            canister_id,
            current_wasm_version: bucket.wasm_version,
            new_wasm_version: new_wasm.version,
            new_wasm: WasmToInstall::Default(new_wasm.module),
            args: storage_bucket_canister::post_upgrade::Args { wasm_version },
            deposit_cycles_if_needed: false,
            mode: CanisterInstallMode::Upgrade(None),
            stop_start_canister: true,
        })
    }

    async fn perform_upgrades(canisters_to_upgrade: Vec<CanisterToUpgrade>) {
        let futures: Vec<_> = canisters_to_upgrade.into_iter().map(perform_upgrade).collect();

        futures::future::join_all(futures).await;
    }

    async fn perform_upgrade(canister_to_upgrade: CanisterToUpgrade) {
        let canister_id = canister_to_upgrade.canister_id;
        let from_version = canister_to_upgrade.current_wasm_version;
        let to_version = canister_to_upgrade.new_wasm_version;

        match utils::canister::install(canister_to_upgrade).await {
            Ok(_) => {
                mutate_state(|state| on_success(canister_id, to_version, state));
            }
            Err(_) => {
                mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
            }
        }
    }

    fn on_success(canister_id: CanisterId, to_version: BuildVersion, state: &mut RuntimeState) {
        if let Some(bucket) = state.data.buckets.get_mut(&canister_id) {
            bucket.wasm_version = to_version;
        }
        state.data.canisters_requiring_upgrade.mark_success(&canister_id);
    }

    fn on_failure(canister_id: CanisterId, from_version: BuildVersion, to_version: BuildVersion, state: &mut RuntimeState) {
        state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
            canister_id,
            from_version,
            to_version,
        });
    }
}
