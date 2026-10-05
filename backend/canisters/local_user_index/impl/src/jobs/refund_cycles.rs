use crate::updates::c2c_delete_group::spawn_delete_canister;
use crate::{CanisterToRefund, RuntimeState, call_relay, mutate_state, read_state};
use constants::{B, CYCLES_REQUIRED_FOR_UPGRADE, MINUTE_IN_MS, min_cycles_balance};
use ic_cdk_management_canister::{CanisterInstallMode, CanisterStatusType};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{BuildVersion, C2CError, CanisterId, CanisterWasmBytes, Cycles, Milliseconds};
use utils::canister::{
    CanisterToInstall, WasmToInstall, delay_if_should_retry_failed_c2c_call, is_invalid_controller_error,
    is_out_of_cycles_error,
};
use utils::cycles::can_spend_cycles;

// Sends the cycles held by uninstalled canisters (those of deleted and migrated users) to the
// CyclesDispenser, by installing a tiny canister on each which does just that, then uninstalling it
// again. The canisters of deleted groups and communities are uninstalled here first, then deleted
// once their cycles have been refunded.
// See backend/canisters/cycles_refunder, which is where this wasm is built from.
const CYCLES_REFUNDER_WASM: &[u8] = include_bytes!("../../../../cycles_refunder/cycles_refunder.wasm");

// A canister which recently ran a large `install_code` (eg. a user canister upgraded shortly
// before the user was deleted) is rate limited from running another for several minutes
const MAX_ATTEMPTS: usize = 10;

// ~80B cycles can never be recovered (see the refunder's README), so below this there is nothing
// worth refunding. This also makes it cheap to queue a canister which has already been refunded.
const MIN_CYCLES_TO_REFUND: Cycles = 100 * B;

// `install_code` prepays for its execution, so the canister must hold this much (its freezing
// threshold having been set to 0), else it is topped up first. The top-up comes back along with
// the rest, so erring on the generous side costs nothing.
pub(crate) const CYCLES_REQUIRED_FOR_INSTALL: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + 100 * B;

// How long a refund waits for this canister's own balance to recover, if topping up the canister
// to refund would take it below its minimum
const CYCLES_BALANCE_TOO_LOW_RETRY_DELAY: Milliseconds = 10 * MINUTE_IN_MS;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    // Set while a canister is being processed. It lives on the heap rather than in `Data` so that
    // an upgrade clears it, whereupon the canister, still at the front of the queue, is picked up
    // again and resumed from wherever it got to.
    static IN_PROGRESS: Cell<bool> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState, delay: Option<Milliseconds>) -> bool {
    if TIMER_ID.get().is_none() && !state.data.cycles_refund_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(delay.unwrap_or_default()), async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

// Whether the canister's cycles are being refunded right now, which is when the canister being
// processed is kept at the front of the queue
pub(crate) fn is_in_progress(state: &RuntimeState, canister_id: CanisterId) -> bool {
    IN_PROGRESS.get()
        && state
            .data
            .cycles_refund_queue
            .front()
            .is_some_and(|c| c.canister_id == canister_id)
}

fn run() {
    trace!("'refund_cycles' running");
    TIMER_ID.set(None);

    if IN_PROGRESS.get() {
        return;
    }

    match mutate_state(get_next) {
        Ok(canister) => {
            IN_PROGRESS.set(true);
            utils::async_work::spawn_tracked(process_canister(canister));
        }
        Err(Some(delay)) => {
            read_state(|state| start_job_if_required(state, Some(delay)));
        }
        Err(None) => {}
    }
}

// Returns the next canister whose retry delay (if any) has elapsed, having rotated it to the
// front of the queue where it stays until it has been processed, else how long until the first
// of them is due. A canister reserved for the call relay is left until the relay is done with it.
fn get_next(state: &mut RuntimeState) -> Result<CanisterToRefund, Option<Milliseconds>> {
    let now = state.env.now();
    let queue = &mut state.data.cycles_refund_queue;
    for _ in 0..queue.len() {
        if let Some(front) = queue.front()
            && front.retry_after <= now
            && !call_relay::is_in_use(front.canister_id)
        {
            return Ok(front.clone());
        }
        if let Some(front) = queue.pop_front() {
            queue.push_back(front);
        }
    }
    Err(queue
        .iter()
        .map(|c| {
            let due_in = c.retry_after.saturating_sub(now);
            if call_relay::is_in_use(c.canister_id) { due_in.max(MINUTE_IN_MS) } else { due_in }
        })
        .min())
}

async fn process_canister(canister: CanisterToRefund) {
    let canister_id = canister.canister_id;
    let result = refund_cycles(canister_id, canister.delete_canister).await;

    mutate_state(|state| {
        IN_PROGRESS.set(false);
        if state
            .data
            .cycles_refund_queue
            .front()
            .is_some_and(|c| c.canister_id == canister_id)
        {
            state.data.cycles_refund_queue.pop_front();
        }

        let mut retrying = false;
        match result {
            Ok(cycles) => {
                state.data.cycles_refunded_from_deleted_users += cycles;
                info!(%canister_id, cycles, "Refunded cycles from uninstalled canister");
            }
            Err(RefundError::NotController) => {
                error!(%canister_id, "Cycles not refunded, this canister is not a controller");
            }
            Err(RefundError::CanisterHasCode) => {
                error!(%canister_id, "Cycles not refunded, the canister has code installed");
            }
            Err(RefundError::InCanisterPool) => {
                info!(%canister_id, "Cycles not refunded, the canister is in the canister pool");
            }
            Err(RefundError::TooFewCycles(cycles)) => {
                info!(%canister_id, cycles, "Cycles not refunded, too few to be worth it");
            }
            // Not counted as an attempt, since it clears once this canister is topped up
            Err(RefundError::CyclesBalanceTooLow) => {
                state.data.cycles_refund_queue.push_back(CanisterToRefund {
                    canister_id,
                    attempt: canister.attempt,
                    retry_after: state.env.now() + CYCLES_BALANCE_TOO_LOW_RETRY_DELAY,
                    delete_canister: canister.delete_canister,
                });
                retrying = true;
                info!(%canister_id, "Cycles refund deferred, this canister's cycles balance is too low");
            }
            Err(RefundError::C2C(error)) => {
                let attempt = canister.attempt + 1;
                if let Some(delay) = retry_delay(&error)
                    && attempt < MAX_ATTEMPTS
                {
                    state.data.cycles_refund_queue.push_back(CanisterToRefund {
                        canister_id,
                        attempt,
                        retry_after: state.env.now() + delay,
                        delete_canister: canister.delete_canister,
                    });
                    retrying = true;
                } else {
                    error!(%canister_id, ?error, "Cycles not refunded, giving up");
                }
            }
        }

        // A deleted group's or community's canister is deleted once nothing more is to be
        // refunded from it
        if canister.delete_canister && !retrying {
            spawn_delete_canister(canister_id);
        }
        start_job_if_required(state, None);
    });
}

// Only errors which can clear on their own are worth retrying, eg. the install_code rate limit.
// In particular another LocalUserIndex's canister is always rejected as we don't control it.
fn retry_delay(error: &C2CError) -> Option<Milliseconds> {
    if is_invalid_controller_error(error.reject_code(), error.message())
        || is_out_of_cycles_error(error.reject_code(), error.message())
    {
        None
    } else {
        delay_if_should_retry_failed_c2c_call(error)
    }
}

enum RefundError {
    NotController,
    CanisterHasCode,
    InCanisterPool,
    TooFewCycles(Cycles),
    // Topping the canister up to install the refunder would take this canister's own balance below
    // its minimum
    CyclesBalanceTooLow,
    C2C(C2CError),
}

impl From<C2CError> for RefundError {
    fn from(error: C2CError) -> Self {
        RefundError::C2C(error)
    }
}

async fn refund_cycles(canister_id: CanisterId, delete_canister: bool) -> Result<Cycles, RefundError> {
    let (cycles_dispenser_canister_id, in_canister_pool) = read_state(|state| {
        (
            state.data.cycles_dispenser_canister_id,
            state.data.canister_pool.contains(&canister_id),
        )
    });

    // A pool canister may yet become a live canister, so it must be left as it is, in particular
    // without its freezing threshold having been set to 0 (see below)
    if in_canister_pool {
        return Err(RefundError::InCanisterPool);
    }
    let wasm = CanisterWasmBytes(CYCLES_REFUNDER_WASM.to_vec());

    let status = utils::canister::canister_status(canister_id).await?;

    // Only a controller can call `canister_status`, so this can't fail, but be explicit
    if !status.settings.controllers.contains(&ic_cdk::api::canister_self()) {
        return Err(RefundError::NotController);
    }

    let mut module_hash = status.module_hash.clone();
    if module_hash.as_ref().is_some_and(|hash| {
        // The call relay, left installed by a move of the canister's funds which failed to
        // uninstall it
        *hash == call_relay::wasm().hash()
            // A deleted group's or community's code, which is uninstalled here rather than when
            // the group or community is deleted so that a failure to uninstall it is retried
            || (delete_canister && *hash != wasm.hash())
    }) {
        utils::canister::uninstall(canister_id).await?;
        module_hash = None;
    }

    match module_hash {
        None => {
            let balance = status.cycles();
            if balance < MIN_CYCLES_TO_REFUND {
                return Err(RefundError::TooFewCycles(balance));
            }

            // The refunder can only send the canister's liquid balance, which excludes the cycles
            // held back by its freezing threshold, so set the threshold to 0 to refund those too
            if status.settings.freezing_threshold != 0u32 {
                utils::canister::set_freezing_threshold(canister_id, 0).await?;
            }

            if balance < CYCLES_REQUIRED_FOR_INSTALL {
                let top_up = CYCLES_REQUIRED_FOR_INSTALL - balance;
                if !read_state(|state| can_spend_cycles(top_up, min_cycles_balance(state.data.test_mode))) {
                    return Err(RefundError::CyclesBalanceTooLow);
                }
                utils::canister::deposit_cycles(canister_id, top_up).await?;
                mutate_state(|state| state.data.cycles_topped_up_for_refunds += top_up);
            }
            install_refunder(canister_id, wasm.clone(), cycles_dispenser_canister_id).await?;
        }
        // A previous attempt installed the refunder but was interrupted before uninstalling it.
        // It may already have sent the cycles, leaving too few to be worth a fresh attempt, so
        // the balance isn't checked here: `refund` simply replies 0 and the uninstall completes.
        Some(hash) if hash == wasm.hash() => {}
        Some(_) => return Err(RefundError::CanisterHasCode),
    }

    // The refunder can only be called while the canister is running, and a deleted group's or
    // community's canister is stopped before it is uninstalled
    if status.status != CanisterStatusType::Running {
        utils::canister::start(canister_id).await?;
    }

    let cycles: u64 = canister_client::make_c2c_call(
        canister_id,
        "refund",
        (),
        candid::encode_args,
        |bytes| candid::decode_one::<u64>(bytes),
        None,
    )
    .await?;

    utils::canister::uninstall(canister_id).await?;

    Ok(cycles.into())
}

// `Install` mode fails if the canister has code, so a live canister can never be overwritten
// even if the status check above is somehow stale
async fn install_refunder(
    canister_id: CanisterId,
    wasm: CanisterWasmBytes,
    cycles_dispenser_canister_id: CanisterId,
) -> Result<(), C2CError> {
    utils::canister::install(CanisterToInstall {
        canister_id,
        current_wasm_version: BuildVersion::default(),
        new_wasm_version: BuildVersion::default(),
        args: candid::encode_one(Some(cycles_dispenser_canister_id)).unwrap(),
        new_wasm: WasmToInstall::Default(wasm),
        top_up_keeping_balance_above: None,
        mode: CanisterInstallMode::Install,
        stop_start_canister: false,
    })
    .await
    .map(|_| ())
}
