use crate::jobs::clear_chunk_store_if_no_pending_upgrades;
use crate::{RuntimeState, mutate_state};
use constants::min_cycles_balance;
use ic_cdk::management_canister::CanisterInstallMode;
use ic_cdk_timers::TimerId;
use local_user_index_canister::ChildCanisterType;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{BuildVersion, CanisterId, Cycles, CyclesTopUp, UserId};
use utils::canister::{CanisterToInstall, ChunkedWasmToInstall, FailedUpgrade, WasmToInstall, install};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && state.data.user_upgrade_concurrency > 0
        && (state.data.users_requiring_upgrade.count_pending() > 0
            || state.data.users_requiring_upgrade.count_in_progress() > 0)
    {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'upgrade_users' job started");
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
        trace!("'upgrade_users' job stopped");

        clear_chunk_store_if_no_pending_upgrades();
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<CanisterToInstall>> {
    if state.data.event_store_client.info().events_pending > 100000 {
        return Some(Vec::new());
    } else if state.data.user_upgrade_concurrency == 0 {
        return None;
    }

    let count_in_progress = state.data.users_requiring_upgrade.count_in_progress();
    let count_pending = state.data.users_requiring_upgrade.count_pending();

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

fn try_get_next(state: &mut RuntimeState) -> Option<CanisterToInstall> {
    let (canister_id, force) = state.data.users_requiring_upgrade.try_take_next()?;

    initialize_upgrade(canister_id, force, state).or_else(|| {
        state.data.users_requiring_upgrade.mark_skipped(&canister_id);
        None
    })
}

fn initialize_upgrade(canister_id: CanisterId, force: bool, state: &mut RuntimeState) -> Option<CanisterToInstall> {
    let user_id = canister_id.into();
    let user = state.data.local_users.get_mut(&user_id)?;
    let user_canister_wasm = &state.data.child_canister_wasms.get(ChildCanisterType::User);
    let current_wasm_version = user.wasm_version;
    let new_wasm_version = user_canister_wasm.wasm.version;
    let deposit_cycles_if_needed = ic_cdk::api::canister_cycle_balance() > min_cycles_balance(state.data.test_mode);

    if current_wasm_version == new_wasm_version && !force {
        return None;
    }

    user.set_canister_upgrade_status(true, None);

    Some(CanisterToInstall {
        canister_id,
        current_wasm_version,
        new_wasm_version,
        new_wasm: if user_canister_wasm.chunks.is_empty() {
            WasmToInstall::Default(user_canister_wasm.wasm.module.clone())
        } else {
            WasmToInstall::Chunked(ChunkedWasmToInstall {
                chunks: user_canister_wasm.chunks.clone(),
                wasm_hash: user_canister_wasm.wasm_hash,
                store_canister_id: state.env.canister_id(),
            })
        },
        deposit_cycles_if_needed,
        args: candid::encode_one(&user_canister::post_upgrade::Args {
            wasm_version: new_wasm_version,
        })
        .unwrap(),
        mode: CanisterInstallMode::Upgrade(None),
        stop_start_canister: true,
    })
}

async fn perform_upgrades(canisters_to_upgrade: Vec<CanisterToInstall>) {
    let futures: Vec<_> = canisters_to_upgrade.into_iter().map(perform_upgrade).collect();

    futures::future::join_all(futures).await;
}

async fn perform_upgrade(canister_to_upgrade: CanisterToInstall) {
    let canister_id = canister_to_upgrade.canister_id;
    let from_version = canister_to_upgrade.current_wasm_version;
    let to_version = canister_to_upgrade.new_wasm_version;

    match install(canister_to_upgrade).await {
        Ok(cycles_top_up) => {
            mutate_state(|state| on_success(canister_id, to_version, cycles_top_up, state));
        }
        Err(_) => {
            mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
        }
    }
}

fn on_success(canister_id: CanisterId, to_version: BuildVersion, top_up: Option<Cycles>, state: &mut RuntimeState) {
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

    state.data.users_requiring_upgrade.mark_success(&canister_id);
}

fn on_failure(canister_id: CanisterId, from_version: BuildVersion, to_version: BuildVersion, state: &mut RuntimeState) {
    mark_upgrade_complete(canister_id.into(), None, state);

    state.data.users_requiring_upgrade.mark_failure(FailedUpgrade {
        canister_id,
        from_version,
        to_version,
    });
}

fn mark_upgrade_complete(canister_id: UserId, new_wasm_version: Option<BuildVersion>, state: &mut RuntimeState) {
    if let Some(user) = state.data.local_users.get_mut(&canister_id) {
        user.set_canister_upgrade_status(false, new_wasm_version);
    }
}
