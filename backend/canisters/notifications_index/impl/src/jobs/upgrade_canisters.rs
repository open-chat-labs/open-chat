use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, Version};
use utils::canister::{upgrade, FailedUpgrade};

type CanisterToUpgrade = utils::canister::CanisterToUpgrade<notifications_canister::post_upgrade::Args>;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none())
        && (runtime_state.data.canisters_requiring_upgrade.count_pending() > 0
            || runtime_state.data.canisters_requiring_upgrade.count_in_progress() > 0)
    {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::from_secs(2), run);
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

fn try_get_next(runtime_state: &mut RuntimeState) -> GetNextResult {
    if runtime_state.data.canisters_requiring_upgrade.count_in_progress() > 0 {
        return GetNextResult::Continue;
    }
    if runtime_state.data.canisters_requiring_upgrade.count_pending() == 0 {
        return GetNextResult::QueueEmpty;
    }

    let canister_id = match runtime_state.data.canisters_requiring_upgrade.try_take_next() {
        Some(c) => c,
        None => return GetNextResult::Continue,
    };

    let current_wasm_version = match runtime_state.data.notifications_canisters.get(&canister_id) {
        Some(canister) => canister.wasm_version(),
        None => {
            runtime_state.data.canisters_requiring_upgrade.mark_skipped(&canister_id);
            return GetNextResult::Continue;
        }
    };

    let new_wasm = runtime_state.data.notifications_canister_wasm_for_upgrades.clone();
    let wasm_version = new_wasm.version;

    GetNextResult::Success(CanisterToUpgrade {
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
