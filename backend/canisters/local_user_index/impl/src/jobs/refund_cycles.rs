use crate::{CanisterToRefund, RuntimeState, mutate_state, read_state};
use constants::{B, CYCLES_REQUIRED_FOR_UPGRADE};
use ic_cdk_management_canister::CanisterInstallMode;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{BuildVersion, C2CError, CanisterId, CanisterWasmBytes, Cycles, Milliseconds};
use utils::canister::{
    CanisterToInstall, WasmToInstall, delay_if_should_retry_failed_c2c_call, is_invalid_controller_error,
    is_out_of_cycles_error,
};

// Sends the cycles held by deleted users' uninstalled canisters to the CyclesDispenser, by
// installing a tiny canister on each which does just that, then uninstalling it again.
// See backend/canisters/cycles_refunder, which is where this wasm is built from.
const CYCLES_REFUNDER_WASM: &[u8] = include_bytes!("../../../../cycles_refunder/cycles_refunder.wasm");

// A canister which recently ran a large `install_code` (eg. a user canister upgraded shortly
// before the user was deleted) is rate limited from running another for several minutes
const MAX_ATTEMPTS: usize = 10;

// ~80B cycles can never be recovered (see the refunder's README), so below this there is nothing
// worth refunding. This also makes it cheap to queue a canister which has already been refunded.
const MIN_CYCLES_TO_REFUND: Cycles = 100 * B;

// `install_code` needs ~300B cycles up front, so canisters with less are topped up first. The
// top-up comes back along with the rest, so its size barely matters, but this margin covers the
// shortfall reported by the IC being a lower bound.
const TOP_UP_MARGIN: Cycles = 50 * B;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
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

fn run() {
    trace!("'refund_cycles' running");
    TIMER_ID.set(None);

    match mutate_state(get_next) {
        // As with the other jobs, if the canister is upgraded mid-way through the canister is
        // simply dropped. Re-queueing it (eg. via `refund_deleted_user_cycles`) picks up from
        // wherever it got to.
        Ok(canister) => ic_cdk::futures::spawn_migratory(process_canister(canister)),
        Err(Some(delay)) => {
            read_state(|state| start_job_if_required(state, Some(delay)));
        }
        Err(None) => {}
    }
}

// Returns the next canister whose retry delay (if any) has elapsed, rotating those which are
// not yet due to the back of the queue, else how long until the first of them is due
fn get_next(state: &mut RuntimeState) -> Result<CanisterToRefund, Option<Milliseconds>> {
    let now = state.env.now();
    let queue = &mut state.data.cycles_refund_queue;
    for _ in 0..queue.len() {
        let Some(front) = queue.pop_front() else { break };
        if front.retry_after <= now {
            return Ok(front);
        }
        queue.push_back(front);
    }
    Err(queue.iter().map(|c| c.retry_after.saturating_sub(now)).min())
}

async fn process_canister(canister: CanisterToRefund) {
    let canister_id = canister.canister_id;
    let result = refund_cycles(canister_id).await;

    mutate_state(|state| {
        match result {
            Ok(cycles) => {
                state.data.cycles_refunded_from_deleted_users += cycles;
                info!(%canister_id, cycles, "Refunded cycles from deleted user's canister");
            }
            Err(RefundError::CanisterHasCode) => {
                error!(%canister_id, "Cycles not refunded, the canister has code installed");
            }
            Err(RefundError::TooFewCycles(cycles)) => {
                info!(%canister_id, cycles, "Cycles not refunded, too few to be worth it");
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
                    });
                } else {
                    error!(%canister_id, ?error, "Cycles not refunded, giving up");
                }
            }
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
    CanisterHasCode,
    TooFewCycles(Cycles),
    C2C(C2CError),
}

impl From<C2CError> for RefundError {
    fn from(error: C2CError) -> Self {
        RefundError::C2C(error)
    }
}

async fn refund_cycles(canister_id: CanisterId) -> Result<Cycles, RefundError> {
    let cycles_dispenser_canister_id = read_state(|state| state.data.cycles_dispenser_canister_id);
    let wasm = CanisterWasmBytes(CYCLES_REFUNDER_WASM.to_vec());

    let status = utils::canister::canister_status(canister_id).await?;
    let balance = u128::try_from(status.cycles.0).unwrap_or(u128::MAX);
    if balance < MIN_CYCLES_TO_REFUND {
        return Err(RefundError::TooFewCycles(balance));
    }
    match status.module_hash {
        None => {
            let init_arg = candid::encode_one(Some(cycles_dispenser_canister_id)).unwrap();
            if let Err(error) = install_refunder(canister_id, wasm.clone(), init_arg.clone()).await {
                if !is_out_of_cycles_error(error.reject_code(), error.message()) {
                    return Err(error.into());
                }
                // The canister has too few cycles to run `install_code`, which prepays for its
                // execution, so top it up. The top-up is sent back along with the rest.
                let top_up = cycles_shortfall(error.message()).unwrap_or(CYCLES_REQUIRED_FOR_UPGRADE) + TOP_UP_MARGIN;
                utils::canister::deposit_cycles(canister_id, top_up).await?;
                mutate_state(|state| state.data.cycles_topped_up_for_refunds += top_up);
                install_refunder(canister_id, wasm, init_arg).await?;
            }
        }
        // A previous attempt installed the refunder but failed before uninstalling it
        Some(hash) if hash == wasm.hash() => {}
        Some(_) => return Err(RefundError::CanisterHasCode),
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
async fn install_refunder(canister_id: CanisterId, wasm: CanisterWasmBytes, init_arg: Vec<u8>) -> Result<(), C2CError> {
    utils::canister::install(CanisterToInstall {
        canister_id,
        current_wasm_version: BuildVersion::default(),
        new_wasm_version: BuildVersion::default(),
        args: init_arg,
        new_wasm: WasmToInstall::Default(wasm),
        deposit_cycles_if_needed: false,
        mode: CanisterInstallMode::Install,
        stop_start_canister: false,
    })
    .await
    .map(|_| ())
}

// Parses the shortfall from an out of cycles reject message, eg. "Canister abc is out of cycles:
// please top up the canister with at least 217_884_065_722 additional cycles"
fn cycles_shortfall(message: &str) -> Option<Cycles> {
    let (_, rest) = message.split_once("at least ")?;
    let number = rest.split_whitespace().next()?;
    number.replace('_', "").parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_cycles_shortfall() {
        let message = "Canister qjjka-fx777-77776-aaajq-cai is out of cycles: please top up the canister with at least 217_884_065_722 additional cycles.\nTop up the canister with more cycles.";
        assert_eq!(cycles_shortfall(message), Some(217_884_065_722));
        assert_eq!(cycles_shortfall("something else"), None);
    }
}
