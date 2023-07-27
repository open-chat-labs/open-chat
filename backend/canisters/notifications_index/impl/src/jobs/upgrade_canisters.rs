use crate::{mutate_state, RuntimeState};
use ic_cdk::api::management_canister::main::CanisterInstallMode;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, Version};
use utils::canister::{install, FailedUpgrade};
use utils::consts::MIN_CYCLES_BALANCE;

type CanisterToUpgrade = utils::canister::CanisterToInstall<notifications_canister::post_upgrade::Args>;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none())
        && (state.data.canisters_requiring_upgrade.count_pending() > 0
            || state.data.canisters_requiring_upgrade.count_in_progress() > 0)
    {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'upgrade_canisters' job started");
        true
    } else {
        false
    }
}

fn run() {
    match mutate_state(try_get_next) {
        GetNextResult::Success(canister_to_upgrade) => ic_cdk::spawn(perform_upgrade(canister_to_upgrade)),
        GetNextResult::Continue => {}
        GetNextResult::QueueEmpty => {
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("'upgrade_canisters' job stopped");
            }
        }
    }
}

enum GetNextResult {
    Success(CanisterToUpgrade),
    Continue,
    QueueEmpty,
}

fn try_get_next(state: &mut RuntimeState) -> GetNextResult {
    if state.data.canisters_requiring_upgrade.count_in_progress() > 0 {
        return GetNextResult::Continue;
    }
    if state.data.canisters_requiring_upgrade.count_pending() == 0 {
        return GetNextResult::QueueEmpty;
    }

    let (canister_id, force) = match state.data.canisters_requiring_upgrade.try_take_next() {
        Some(c) => c,
        None => return GetNextResult::Continue,
    };

    let new_wasm_version = state.data.notifications_canister_wasm_for_upgrades.version;
    let current_wasm_version = match state
        .data
        .notifications_canisters
        .get(&canister_id)
        .map(|c| c.wasm_version())
        .filter(|v| *v != new_wasm_version || force)
    {
        Some(v) => v,
        None => {
            state.data.canisters_requiring_upgrade.mark_skipped(&canister_id);
            return GetNextResult::Continue;
        }
    };

    let new_wasm = state.data.notifications_canister_wasm_for_upgrades.clone();
    let deposit_cycles_if_needed = ic_cdk::api::canister_balance128() > MIN_CYCLES_BALANCE;

    GetNextResult::Success(CanisterToUpgrade {
        canister_id,
        current_wasm_version,
        new_wasm,
        deposit_cycles_if_needed,
        args: notifications_canister::post_upgrade::Args {
            wasm_version: new_wasm_version,
        },
        mode: CanisterInstallMode::Upgrade,
        stop_start_canister: true,
    })
}

async fn perform_upgrade(canister_to_upgrade: CanisterToUpgrade) {
    let canister_id = canister_to_upgrade.canister_id;
    let from_version = canister_to_upgrade.current_wasm_version;
    let to_version = canister_to_upgrade.new_wasm.version;

    match install(canister_to_upgrade).await {
        Ok(_) => {
            mutate_state(|state| on_success(canister_id, to_version, state));
        }
        Err(_) => {
            mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
        }
    }
}

fn on_success(canister_id: CanisterId, to_version: Version, state: &mut RuntimeState) {
    if let Some(canister) = state.data.notifications_canisters.get_mut(&canister_id) {
        canister.set_wasm_version(to_version);
    }

    state.data.canisters_requiring_upgrade.mark_success(&canister_id);
}

fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, state: &mut RuntimeState) {
    state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
        canister_id,
        from_version,
        to_version,
    });
}
