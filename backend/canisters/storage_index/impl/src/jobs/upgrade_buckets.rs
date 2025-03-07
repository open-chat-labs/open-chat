use crate::{mutate_state, RuntimeState};
use ic_cdk::management_canister::CanisterInstallMode;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{BuildVersion, CanisterId};
use utils::canister::{install, FailedUpgrade, WasmToInstall};

const MAX_CONCURRENT_CANISTER_UPGRADES: usize = 1;

type CanisterToUpgrade = utils::canister::CanisterToInstall<storage_bucket_canister::post_upgrade::Args>;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && (state.data.canisters_requiring_upgrade.count_pending() > 0
            || state.data.canisters_requiring_upgrade.count_in_progress() > 0)
    {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'upgrade_buckets' job started");
        true
    } else {
        false
    }
}

fn run() {
    if let Some(batch) = mutate_state(next_batch) {
        if !batch.is_empty() {
            ic_cdk::futures::spawn(perform_upgrades(batch));
        }
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'upgrade_buckets' job stopped");
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<CanisterToUpgrade>> {
    let count_in_progress = state.data.canisters_requiring_upgrade.count_in_progress();
    let count_pending = state.data.canisters_requiring_upgrade.count_pending();

    if count_in_progress == 0 && count_pending == 0 {
        None
    } else {
        Some(
            (0..(MAX_CONCURRENT_CANISTER_UPGRADES - count_in_progress))
                .map_while(|_| try_get_next(state))
                .collect(),
        )
    }
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

    match install(canister_to_upgrade).await {
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
