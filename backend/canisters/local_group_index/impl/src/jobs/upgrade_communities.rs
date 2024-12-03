use crate::{mutate_state, RuntimeState};
use constants::min_cycles_balance;
use ic_cdk::api::management_canister::main::CanisterInstallMode;
use ic_cdk_timers::TimerId;
use local_group_index_canister::ChildCanisterType;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{BuildVersion, CanisterId, CommunityId, Cycles, CyclesTopUp};
use utils::canister;
use utils::canister::{install, ChunkedWasmToInstall, FailedUpgrade, WasmToInstall};

type CanisterToUpgrade = canister::CanisterToInstall<community_canister::post_upgrade::Args>;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && state.data.community_upgrade_concurrency > 0
        && (state.data.communities_requiring_upgrade.count_pending() > 0
            || state.data.communities_requiring_upgrade.count_in_progress() > 0)
    {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'upgrade_communities' job started");
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
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'upgrade_communities' job stopped");
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<CanisterToUpgrade>> {
    if state.data.event_store_client.info().events_pending > 100000 {
        return Some(Vec::new());
    } else if state.data.community_upgrade_concurrency == 0 {
        return None;
    }

    let count_in_progress = state.data.communities_requiring_upgrade.count_in_progress();
    let count_pending = state.data.communities_requiring_upgrade.count_pending();

    if count_in_progress == 0 && count_pending == 0 {
        None
    } else {
        let community_upgrade_concurrency = state.data.community_upgrade_concurrency as usize;

        Some(
            (0..(community_upgrade_concurrency.saturating_sub(count_in_progress)))
                .map_while(|_| try_get_next(state))
                .collect(),
        )
    }
}

fn try_get_next(state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
    let (canister_id, force) = state.data.communities_requiring_upgrade.try_take_next()?;

    initialize_upgrade(canister_id, force, state).or_else(|| {
        state.data.communities_requiring_upgrade.mark_skipped(&canister_id);
        None
    })
}

fn initialize_upgrade(canister_id: CanisterId, force: bool, state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
    let community_id = canister_id.into();
    let community = state.data.local_communities.get_mut(&community_id)?;
    let community_canister_wasm = &state.data.child_canister_wasms.get(ChildCanisterType::Community);
    let current_wasm_version = community.wasm_version;
    let new_wasm_version = community_canister_wasm.wasm.version;
    let deposit_cycles_if_needed = ic_cdk::api::canister_balance128() > min_cycles_balance(state.data.test_mode);

    if current_wasm_version == new_wasm_version && !force {
        return None;
    }

    community.set_canister_upgrade_status(true, None);

    Some(CanisterToUpgrade {
        canister_id,
        current_wasm_version,
        new_wasm_version,
        new_wasm: if community_canister_wasm.chunks.is_empty() {
            WasmToInstall::Default(community_canister_wasm.wasm.module.clone())
        } else {
            WasmToInstall::Chunked(ChunkedWasmToInstall {
                chunks: community_canister_wasm.chunks.clone(),
                wasm_hash: community_canister_wasm.wasm_hash,
                store_canister_id: state.env.canister_id(),
            })
        },
        deposit_cycles_if_needed,
        args: community_canister::post_upgrade::Args {
            wasm_version: new_wasm_version,
        },
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
        Ok(cycles_top_up) => {
            mutate_state(|state| on_success(canister_id, to_version, cycles_top_up, state));
        }
        Err(_) => {
            mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
        }
    }
}

fn on_success(canister_id: CanisterId, to_version: BuildVersion, top_up: Option<Cycles>, state: &mut RuntimeState) {
    let community_id = canister_id.into();
    mark_upgrade_complete(community_id, Some(to_version), state);

    if let Some(top_up) = top_up {
        state.data.local_communities.mark_cycles_top_up(
            &community_id,
            CyclesTopUp {
                amount: top_up,
                date: state.env.now(),
            },
        );
    }

    state.data.communities_requiring_upgrade.mark_success(&canister_id);
}

fn on_failure(canister_id: CanisterId, from_version: BuildVersion, to_version: BuildVersion, state: &mut RuntimeState) {
    mark_upgrade_complete(canister_id.into(), None, state);

    state.data.communities_requiring_upgrade.mark_failure(FailedUpgrade {
        canister_id,
        from_version,
        to_version,
    });
}

fn mark_upgrade_complete(community_id: CommunityId, new_wasm_version: Option<BuildVersion>, state: &mut RuntimeState) {
    if let Some(community) = state.data.local_communities.get_mut(&community_id) {
        community.set_canister_upgrade_status(false, new_wasm_version);
    }
}
