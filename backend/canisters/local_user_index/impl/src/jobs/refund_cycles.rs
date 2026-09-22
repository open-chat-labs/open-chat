use crate::{CanisterToRefund, RuntimeState, mutate_state, read_state};
use constants::MINUTE_IN_MS;
use ic_cdk_management_canister::CanisterInstallMode;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{BuildVersion, C2CError, CanisterId, CanisterWasmBytes, Cycles, Milliseconds};
use utils::canister::{CanisterToInstall, WasmToInstall};

// Sends the cycles held by deleted users' uninstalled canisters to the CyclesDispenser, by
// installing a tiny canister on each which does just that, then uninstalling it again.
// See backend/canisters/cycles_refunder, which is where this wasm is built from.
const CYCLES_REFUNDER_WASM: &[u8] = include_bytes!("../../../../cycles_refunder/cycles_refunder.wasm");

// A canister which recently ran a large `install_code` (eg. a user canister upgraded shortly
// before the user was deleted) is rate limited from running another for several minutes
const MAX_ATTEMPTS: usize = 10;
const RETRY_DELAY: Milliseconds = 5 * MINUTE_IN_MS;

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
            Err(RefundError::C2C(error)) => {
                let attempt = canister.attempt + 1;
                if attempt < MAX_ATTEMPTS {
                    state.data.cycles_refund_queue.push_back(CanisterToRefund {
                        canister_id,
                        attempt,
                        retry_after: state.env.now() + RETRY_DELAY,
                    });
                } else {
                    error!(%canister_id, ?error, "Cycles not refunded, giving up");
                }
            }
        }
        start_job_if_required(state, None);
    });
}

enum RefundError {
    CanisterHasCode,
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
    match status.module_hash {
        None => {
            // `Install` mode fails if the canister has code, so a live canister can never be
            // overwritten even if the status check above is somehow stale
            utils::canister::install(CanisterToInstall {
                canister_id,
                current_wasm_version: BuildVersion::default(),
                new_wasm_version: BuildVersion::default(),
                args: candid::encode_one(Some(cycles_dispenser_canister_id)).unwrap(),
                new_wasm: WasmToInstall::Default(wasm),
                deposit_cycles_if_needed: false,
                mode: CanisterInstallMode::Install,
                stop_start_canister: false,
            })
            .await?;
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
