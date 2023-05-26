use crate::{mutate_state, RuntimeState};
use ic_cdk::api::management_canister::main::CanisterInstallMode;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, Cycles, CyclesTopUp, UserId, Version};
use utils::canister::{install, FailedUpgrade};
use utils::consts::MIN_CYCLES_BALANCE;

type CanisterToUpgrade = utils::canister::CanisterToInstall<user_canister::post_upgrade::Args>;

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
    if let Some(batch) = mutate_state(next_batch) {
        if !batch.is_empty() {
            ic_cdk::spawn(perform_upgrades(batch));
        }
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'upgrade_canisters' job stopped");
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<CanisterToUpgrade>> {
    let count_in_progress = state.data.canisters_requiring_upgrade.count_in_progress();
    let count_pending = state.data.canisters_requiring_upgrade.count_pending();

    if count_in_progress == 0 && count_pending == 0 {
        None
    } else {
        let user_upgrade_concurrency = state.data.user_upgrade_concurrency as usize;

        Some(
            (0..(user_upgrade_concurrency.saturating_sub(count_in_progress)))
                .map_while(|_| try_get_next(state))
                .collect(),
        )
    }
}

fn try_get_next(state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
    let canister_id = state.data.canisters_requiring_upgrade.try_take_next()?;

    initialize_upgrade(canister_id, state).or_else(|| {
        state.data.canisters_requiring_upgrade.mark_skipped(&canister_id);
        None
    })
}

fn initialize_upgrade(canister_id: CanisterId, state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
    let user_id = canister_id.into();
    let user = state.data.local_users.get_mut(&user_id)?;
    let current_wasm_version = user.wasm_version;
    let user_canister_wasm = &state.data.user_canister_wasm_for_upgrades;
    let deposit_cycles_if_needed = ic_cdk::api::canister_balance128() > MIN_CYCLES_BALANCE;

    if current_wasm_version == user_canister_wasm.version {
        return None;
    }

    user.set_canister_upgrade_status(true, None);

    Some(CanisterToUpgrade {
        canister_id,
        current_wasm_version,
        new_wasm: user_canister_wasm.clone(),
        deposit_cycles_if_needed,
        args: user_canister::post_upgrade::Args {
            wasm_version: user_canister_wasm.version,
        },
        mode: CanisterInstallMode::Upgrade,
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
    let to_version = canister_to_upgrade.new_wasm.version;

    match install(canister_to_upgrade).await {
        Ok(cycles_top_up) => {
            mutate_state(|state| on_success(canister_id, to_version, cycles_top_up, state));
        }
        Err(_) => {
            mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
        }
    }
}

fn on_success(canister_id: CanisterId, to_version: Version, top_up: Option<Cycles>, state: &mut RuntimeState) {
    let user_id = canister_id.into();
    mark_upgrade_complete(user_id, Some(to_version), state);

    if let Some(top_up) = top_up {
        state.data.local_users.mark_cycles_top_up(
            &user_id,
            CyclesTopUp {
                amount: top_up,
                date: state.env.now(),
            },
        );
    }

    state.data.canisters_requiring_upgrade.mark_success(&canister_id);
}

fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, state: &mut RuntimeState) {
    mark_upgrade_complete(canister_id.into(), None, state);

    state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
        canister_id,
        from_version,
        to_version,
    });
}

fn mark_upgrade_complete(canister_id: UserId, new_wasm_version: Option<Version>, state: &mut RuntimeState) {
    if let Some(user) = state.data.local_users.get_mut(&canister_id) {
        user.set_canister_upgrade_status(false, new_wasm_version);
    }
}
