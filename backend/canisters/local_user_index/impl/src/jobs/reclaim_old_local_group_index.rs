use crate::model::old_local_group_index::CanisterToReclaim;
use crate::updates::move_funds_from_old_canister::{Transfer, balance_of, make_transfer};
use crate::{CanisterToRefund, RuntimeState, call_relay, jobs, mutate_state, read_state};
use constants::{HOUR_IN_MS, ICP_LEDGER_CANISTER_ID, ICP_TRANSFER_FEE, MINUTE_IN_MS, min_cycles_balance};
use futures::future::join_all;
use ic_cdk::call::RejectCode;
use ic_cdk_management_canister::{
    CanisterInstallMode, CanisterSettings, CanisterStatusArgs, CanisterStatusType, UpdateSettingsArgs,
};
use ic_cdk_timers::TimerId;
use icrc_ledger_types::icrc1::account::Account;
use local_user_index_canister::move_funds_from_old_canister::MoveFundsResult;
use oc_error_codes::OCError;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};
use types::{BuildVersion, C2CError, CanisterId, Milliseconds, TimestampNanos};
use utils::canister::{CanisterStatusMinimal, CanisterToInstall, WasmToInstall, is_invalid_controller_error};

const BATCH_SIZE: usize = 10;
const MAX_ATTEMPTS: u32 = 10;
const RETRY_DELAY: Milliseconds = MINUTE_IN_MS;
// Moving the ICP is retried for longer, about 14 hours in all, backing off to an hour between
// attempts, so as to outlast an outage of the ICP ledger
const MAX_ICP_ATTEMPTS: u32 = 20;
const MAX_ICP_RETRY_DELAY: Milliseconds = HOUR_IN_MS;
// The relay's calls to the management canister are answered within a round or two
const RELAY_CALL_TIMEOUT_SECONDS: u32 = 60;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    // Set while a run is in progress, so that a request which starts the job meanwhile doesn't start
    // a second run alongside it. The run in progress schedules the next one once it finishes.
    static IN_PROGRESS: Cell<bool> = Cell::default();
}

// Reclaims the canisters which the old LocalGroupIndex alone still controls, once the GroupIndex has
// made this LocalUserIndex a controller of it. The call relay is installed over the old
// LocalGroupIndex, through which each canister is made to have this LocalUserIndex as its only
// controller, then queued to have its cycles refunded, after which it goes into this
// LocalUserIndex's canister pool, to be given cycles again when used. Then any ICP the old
// LocalGroupIndex holds is moved to the CyclesDispenser through the relay, and finally the old
// LocalGroupIndex's own cycles are refunded.
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
    if IN_PROGRESS.replace(true) {
        return;
    }
    utils::async_work::spawn_tracked(async {
        let _guard = InProgressGuard;
        process().await;
    });
}

// Clears `IN_PROGRESS` once a run finishes, however it finishes
struct InProgressGuard;

impl Drop for InProgressGuard {
    fn drop(&mut self) {
        IN_PROGRESS.set(false);
    }
}

async fn process() {
    let Some((old_local_group_index, relay_installed, icp_dealt_with)) = read_state(|state| {
        state
            .data
            .old_local_group_index
            .as_ref()
            .filter(|old| !old.completed)
            .map(|old| (old.canister_id, old.relay_installed, old.icp_dealt_with))
    }) else {
        return;
    };

    // Keeps the refund job off the old LocalGroupIndex while the relay is in use. Only a move of a
    // migrated user's funds reserves any other canister, so this never fails.
    let Some(_relay_guard) = call_relay::InUseGuard::new(old_local_group_index) else {
        mutate_state(|state| start_job_if_required(state, Some(RETRY_DELAY)));
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
        if icp_dealt_with {
            mutate_state(complete);
        } else {
            move_icp(old_local_group_index).await;
        }
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
            queue_refund(state, canister_id, true);
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

// Moves any ICP the old LocalGroupIndex holds to the CyclesDispenser's account, from which it burns
// ICP for cycles when low. Of the old LocalGroupIndexes, only `suaf3` holds any (5 ICP). If the move
// keeps failing it is given up on, leaving the ICP where it is, from where a later change can move
// it, since the old LocalGroupIndex is kept.
async fn move_icp(old_local_group_index: CanisterId) {
    let (cycles_dispenser, fee, now_nanos) = read_state(|state| {
        (
            state.data.cycles_dispenser_canister_id,
            state
                .data
                .registry_tokens
                .fee(&ICP_LEDGER_CANISTER_ID)
                .unwrap_or(ICP_TRANSFER_FEE),
            state.env.now_nanos(),
        )
    });

    let result = transfer_icp(old_local_group_index, cycles_dispenser, fee, now_nanos).await;

    mutate_state(|state| {
        let Some(old) = state.data.old_local_group_index.as_mut() else {
            return;
        };
        let delay = match result {
            Ok(moved) => {
                old.icp_dealt_with = true;
                old.icp_moved += moved;
                if moved > 0 {
                    info!(%old_local_group_index, moved, "Moved the old LocalGroupIndex's ICP to the CyclesDispenser");
                } else if old.icp_found > fee {
                    info!(
                        %old_local_group_index,
                        found = old.icp_found,
                        "No ICP left to move, so an earlier attempt's transfer went through, its outcome lost"
                    );
                } else {
                    info!(%old_local_group_index, "The old LocalGroupIndex held no ICP to move");
                }
                None
            }
            Err(error) => {
                old.icp_attempts += 1;
                if old.icp_attempts >= MAX_ICP_ATTEMPTS {
                    old.icp_dealt_with = true;
                    error!(%old_local_group_index, ?error, "Failed to move the old LocalGroupIndex's ICP to the CyclesDispenser, giving up");
                    None
                } else {
                    Some(icp_retry_delay(old.icp_attempts))
                }
            }
        };
        start_job_if_required(state, delay);
    });
}

// 1 minute after the first failure, doubling each time up to an hour
fn icp_retry_delay(attempts: u32) -> Milliseconds {
    (RETRY_DELAY << attempts.saturating_sub(1).min(16)).min(MAX_ICP_RETRY_DELAY)
}

// Returns the amount moved, after the fee, which is 0 if the balance doesn't exceed the fee. If an
// earlier attempt's transfer went through but its outcome was lost, this finds nothing to move. The
// balance found is recorded, so the ICP moved can be told from the ICP there was to move.
async fn transfer_icp(from: CanisterId, to: CanisterId, fee: u128, now_nanos: TimestampNanos) -> Result<u128, OCError> {
    let ledger = ICP_LEDGER_CANISTER_ID;
    let balance = balance_of(ledger, Account::from(from)).await?;
    mutate_state(|state| {
        if let Some(old) = state.data.old_local_group_index.as_mut() {
            old.icp_found = old.icp_found.max(balance);
        }
    });
    if balance <= fee {
        return Ok(0);
    }

    let outcome = make_transfer(from, Account::from(to), &Transfer { ledger, balance, fee }, now_nanos).await;
    match outcome.result {
        MoveFundsResult::Moved { amount, .. } => Ok(amount),
        MoveFundsResult::NothingToMove => Ok(0),
        MoveFundsResult::Failed(error) => Err(error),
    }
}

// Once every canister and the ICP have been dealt with, the old LocalGroupIndex's own cycles are
// queued to be refunded, which uninstalls the relay too. It is never deleted, since it may still hold
// funds, eg. if moving its ICP was given up on, or be all that controls a canister which was skipped
// or missed. While this LocalUserIndex controls it, a later change can install the relay again to
// deal with them.
fn complete(state: &mut RuntimeState) {
    let Some(old) = state.data.old_local_group_index.as_mut() else {
        return;
    };
    old.completed = true;
    let canister_id = old.canister_id;
    let metrics = old.metrics();

    if metrics.skipped.is_empty() {
        info!(%canister_id, reclaimed = metrics.reclaimed, "Reclaimed the old LocalGroupIndex's canisters");
    } else {
        error!(
            %canister_id,
            reclaimed = metrics.reclaimed,
            skipped = ?metrics.skipped,
            "Reclaimed the old LocalGroupIndex's canisters, apart from those skipped"
        );
    }
    queue_refund(state, canister_id, false);
    jobs::refund_cycles::start_job_if_required(state, None);
}

// A canister is only handed over if it has no code and the old LocalGroupIndex is its only
// controller, as each one is meant to be an empty pool canister, so that nothing live is ever touched
// and no other controller is ever removed
async fn reclaim(
    old_local_group_index: CanisterId,
    canister_id: CanisterId,
    this_canister_id: CanisterId,
) -> Result<Outcome, C2CError> {
    let status = match relay_canister_status(old_local_group_index, canister_id).await {
        Ok(status) => status,
        // The old LocalGroupIndex no longer controls the canister, which may be because it was
        // handed over by an earlier attempt whose outcome wasn't recorded, in which case this
        // LocalUserIndex is its only controller. Then it counts as reclaimed, and otherwise it is
        // skipped, so that a canister which still has another controller never goes into the pool.
        Err(error) if is_invalid_controller_error(error.reject_code(), error.message()) => {
            return match utils::canister::canister_status(canister_id).await {
                Ok(status) => Ok(check(&status, this_canister_id).map_or(Outcome::Reclaimed, Outcome::Skipped)),
                Err(error) if is_invalid_controller_error(error.reject_code(), error.message()) => Ok(Outcome::Skipped(
                    "Controlled by neither the old LocalGroupIndex nor this LocalUserIndex",
                )),
                Err(error) => Err(error),
            };
        }
        Err(error) => return Err(error),
    };

    if let Some(reason) = check(&status, old_local_group_index) {
        return Ok(Outcome::Skipped(reason));
    }

    relay_set_controllers(old_local_group_index, canister_id, vec![this_canister_id]).await?;
    Ok(Outcome::Reclaimed)
}

// Why the canister isn't to be reclaimed, if it has code or any controller other than `controller`
fn check(status: &CanisterStatusMinimal, controller: CanisterId) -> Option<&'static str> {
    if status.module_hash.is_some() {
        Some("Has code installed")
    } else if status.settings.controllers != [controller] {
        Some("Has other controllers")
    } else {
        None
    }
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
        // An earlier install which failed to restart the canister leaves it stopped
        if status.status != CanisterStatusType::Running {
            utils::canister::start(canister_id).await?;
        }
        return Ok(());
    }

    utils::canister::install(CanisterToInstall {
        canister_id,
        current_wasm_version: BuildVersion::default(),
        new_wasm_version: BuildVersion::default(),
        args: Vec::new(),
        new_wasm: WasmToInstall::Default(call_relay::wasm()),
        // It may have had its cycles refunded, if this is a repeated request
        top_up_keeping_balance_above: Some(read_state(|state| min_cycles_balance(state.data.test_mode))),
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

// A reclaimed canister is put into the canister pool once refunded. The old LocalGroupIndex isn't.
fn queue_refund(state: &mut RuntimeState, canister_id: CanisterId, return_to_pool: bool) {
    let queue = &mut state.data.cycles_refund_queue;
    if !queue.iter().any(|c| c.canister_id == canister_id) {
        queue.push_back(CanisterToRefund {
            canister_id,
            attempt: 0,
            retry_after: 0,
            delete_canister: false,
            return_to_pool,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn icp_retry_delay_doubles_up_to_an_hour() {
        assert_eq!(icp_retry_delay(1), MINUTE_IN_MS);
        assert_eq!(icp_retry_delay(2), 2 * MINUTE_IN_MS);
        assert_eq!(icp_retry_delay(6), 32 * MINUTE_IN_MS);
        assert_eq!(icp_retry_delay(7), HOUR_IN_MS);
        assert_eq!(icp_retry_delay(MAX_ICP_ATTEMPTS), HOUR_IN_MS);
    }

    // About 14 hours, long enough to outlast an outage of the ICP ledger
    #[test]
    fn icp_attempts_span_about_14_hours() {
        let total: Milliseconds = (1..MAX_ICP_ATTEMPTS).map(icp_retry_delay).sum();
        assert_eq!(total, 843 * MINUTE_IN_MS);
    }
}
