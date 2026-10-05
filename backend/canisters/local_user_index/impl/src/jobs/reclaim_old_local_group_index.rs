use crate::model::old_local_group_index::CanisterToReclaim;
use crate::{CanisterToRefund, RuntimeState, call_relay, jobs, mutate_state, read_state};
use constants::MINUTE_IN_MS;
use futures::future::join_all;
use ic_cdk::call::RejectCode;
use ic_cdk_management_canister::{CanisterInstallMode, CanisterSettings, CanisterStatusArgs, UpdateSettingsArgs};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};
use types::{BuildVersion, C2CError, CanisterId, Milliseconds};
use utils::canister::{CanisterStatusMinimal, CanisterToInstall, WasmToInstall, is_invalid_controller_error};

const BATCH_SIZE: usize = 10;
const MAX_ATTEMPTS: u32 = 10;
const RETRY_DELAY: Milliseconds = MINUTE_IN_MS;
// The relay's calls to the management canister are answered within a round or two
const RELAY_CALL_TIMEOUT_SECONDS: u32 = 60;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Reclaims the canisters which the old LocalGroupIndex alone still controls, once the GroupIndex has
// made this LocalUserIndex a controller of it. The call relay is installed over the old
// LocalGroupIndex, through which each canister is made to have this LocalUserIndex as its only
// controller, then queued to have its cycles refunded and be deleted. Finally the old
// LocalGroupIndex itself is.
pub(crate) fn start_job_if_required(state: &RuntimeState, delay: Option<Milliseconds>) -> bool {
    if TIMER_ID.get().is_none() && state.data.old_local_group_index.as_ref().is_some_and(|old| !old.completed) {
        let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(delay.unwrap_or_default()), async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    TIMER_ID.set(None);
    utils::async_work::spawn_tracked(process());
}

async fn process() {
    let Some((old_local_group_index, relay_installed)) = read_state(|state| {
        state
            .data
            .old_local_group_index
            .as_ref()
            .filter(|old| !old.completed)
            .map(|old| (old.canister_id, old.relay_installed))
    }) else {
        return;
    };

    if !relay_installed {
        let result = install_relay(old_local_group_index).await;
        mutate_state(|state| {
            let delay = match result {
                Ok(()) => {
                    if let Some(old) = state.data.old_local_group_index.as_mut() {
                        old.relay_installed = true;
                    }
                    info!(%old_local_group_index, "Installed the call relay over the old LocalGroupIndex");
                    None
                }
                // Including until the GroupIndex has made this LocalUserIndex a controller of it
                Err(error) => {
                    error!(%old_local_group_index, ?error, "Failed to install the call relay over the old LocalGroupIndex");
                    Some(RETRY_DELAY)
                }
            };
            start_job_if_required(state, delay);
        });
        return;
    }

    let batch = mutate_state(|state| {
        state
            .data
            .old_local_group_index
            .as_mut()
            .map(|old| old.take_batch(BATCH_SIZE))
            .unwrap_or_default()
    });

    if batch.is_empty() {
        mutate_state(complete);
        return;
    }

    let this_canister_id = ic_cdk::api::canister_self();
    let results = join_all(
        batch
            .iter()
            .map(|c| reclaim(old_local_group_index, c.canister_id, this_canister_id)),
    )
    .await;

    mutate_state(|state| {
        let mut any_failed = false;
        for (canister, result) in batch.into_iter().zip(results) {
            on_reclaim_result(canister, result, &mut any_failed, state);
        }
        jobs::refund_cycles::start_job_if_required(state, None);
        start_job_if_required(state, any_failed.then_some(RETRY_DELAY));
    });
}

enum Outcome {
    Reclaimed,
    Skipped(&'static str),
}

fn on_reclaim_result(
    canister: CanisterToReclaim,
    result: Result<Outcome, C2CError>,
    any_failed: &mut bool,
    state: &mut RuntimeState,
) {
    let canister_id = canister.canister_id;
    let Some(old) = state.data.old_local_group_index.as_mut() else {
        return;
    };
    match result {
        Ok(Outcome::Reclaimed) => {
            old.mark_reclaimed(canister_id);
            queue_refund_then_delete(state, canister_id);
        }
        Ok(Outcome::Skipped(reason)) => {
            error!(%canister_id, reason, "Canister of the old LocalGroupIndex left as it is");
            old.mark_skipped(canister_id);
        }
        Err(error) => {
            *any_failed = true;
            if canister.attempt + 1 < MAX_ATTEMPTS {
                old.retry(canister);
            } else {
                error!(%canister_id, ?error, "Failed to reclaim canister of the old LocalGroupIndex, giving up");
                old.mark_skipped(canister_id);
            }
        }
    }
}

// Once every canister has been dealt with, the old LocalGroupIndex itself is queued to be refunded
// and deleted. If any were skipped it is kept, since it may be all that still controls them.
fn complete(state: &mut RuntimeState) {
    let Some(old) = state.data.old_local_group_index.as_mut() else {
        return;
    };
    old.completed = true;
    let canister_id = old.canister_id;
    let metrics = old.metrics();

    if metrics.skipped.is_empty() {
        info!(%canister_id, reclaimed = metrics.reclaimed, "Reclaimed the old LocalGroupIndex's canisters, it is now to be refunded and deleted");
        queue_refund_then_delete(state, canister_id);
        jobs::refund_cycles::start_job_if_required(state, None);
    } else {
        error!(
            %canister_id,
            reclaimed = metrics.reclaimed,
            skipped = ?metrics.skipped,
            "Reclaimed the old LocalGroupIndex's canisters, but kept it since some were skipped"
        );
    }
}

// A canister is only handed over if it has no code, as each one is meant to be an empty pool
// canister, so that nothing live is ever touched
async fn reclaim(
    old_local_group_index: CanisterId,
    canister_id: CanisterId,
    this_canister_id: CanisterId,
) -> Result<Outcome, C2CError> {
    let status = match relay_canister_status(old_local_group_index, canister_id).await {
        Ok(status) => status,
        // The old LocalGroupIndex no longer controls the canister, which may be because it was
        // handed over by an earlier attempt whose outcome wasn't recorded
        Err(error) if is_invalid_controller_error(error.reject_code(), error.message()) => {
            return match utils::canister::canister_status(canister_id).await {
                Ok(status) if status.module_hash.is_none() => Ok(Outcome::Reclaimed),
                Ok(_) => Ok(Outcome::Skipped("Has code installed")),
                Err(error) if is_invalid_controller_error(error.reject_code(), error.message()) => Ok(Outcome::Skipped(
                    "Controlled by neither the old LocalGroupIndex nor this LocalUserIndex",
                )),
                Err(error) => Err(error),
            };
        }
        Err(error) => return Err(error),
    };

    if status.module_hash.is_some() {
        return Ok(Outcome::Skipped("Has code installed"));
    }

    relay_set_controllers(old_local_group_index, canister_id, vec![this_canister_id]).await?;
    Ok(Outcome::Reclaimed)
}

// Replaces the old LocalGroupIndex's code with the call relay. Nothing in its state is needed, since
// its canister pool is empty, and its groups and communities are all controlled by this
// LocalUserIndex too. Fails until the GroupIndex has made this LocalUserIndex a controller of it.
async fn install_relay(canister_id: CanisterId) -> Result<(), C2CError> {
    let status = utils::canister::canister_status(canister_id).await?;
    if status
        .module_hash
        .as_ref()
        .is_some_and(|hash| *hash == call_relay::wasm().hash())
    {
        return Ok(());
    }

    utils::canister::install(CanisterToInstall {
        canister_id,
        current_wasm_version: BuildVersion::default(),
        new_wasm_version: BuildVersion::default(),
        args: Vec::new(),
        new_wasm: WasmToInstall::Default(call_relay::wasm()),
        top_up_keeping_balance_above: None,
        mode: if status.module_hash.is_some() {
            CanisterInstallMode::Reinstall
        } else {
            CanisterInstallMode::Install
        },
        stop_start_canister: true,
    })
    .await?;
    Ok(())
}

async fn relay_canister_status(relay: CanisterId, canister_id: CanisterId) -> Result<CanisterStatusMinimal, C2CError> {
    let management_canister = CanisterId::management_canister();
    let method = "canister_status";
    let reply = call_relay::call(
        relay,
        management_canister,
        method,
        &candid::encode_one(CanisterStatusArgs { canister_id }).unwrap(),
        RELAY_CALL_TIMEOUT_SECONDS,
    )
    .await?;
    candid::decode_one(&reply)
        .map_err(|error| C2CError::new(management_canister, method, RejectCode::CanisterReject, error.to_string()))
}

async fn relay_set_controllers(
    relay: CanisterId,
    canister_id: CanisterId,
    controllers: Vec<CanisterId>,
) -> Result<(), C2CError> {
    let args = UpdateSettingsArgs {
        canister_id,
        settings: CanisterSettings {
            controllers: Some(controllers),
            ..Default::default()
        },
    };
    call_relay::call(
        relay,
        CanisterId::management_canister(),
        "update_settings",
        &candid::encode_one(args).unwrap(),
        RELAY_CALL_TIMEOUT_SECONDS,
    )
    .await?;
    Ok(())
}

fn queue_refund_then_delete(state: &mut RuntimeState, canister_id: CanisterId) {
    let queue = &mut state.data.cycles_refund_queue;
    if !queue.iter().any(|c| c.canister_id == canister_id) {
        queue.push_back(CanisterToRefund {
            canister_id,
            attempt: 0,
            retry_after: 0,
            delete_canister: true,
            return_to_pool: false,
        });
    }
}
