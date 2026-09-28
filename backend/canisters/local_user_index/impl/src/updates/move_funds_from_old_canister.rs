use crate::guards::caller_is_openchat_user;
use crate::jobs::refund_cycles::{self, CYCLES_REQUIRED_FOR_INSTALL};
use crate::{CanisterToRefund, RuntimeState, call_relay, mutate_state, read_state};
use candid::Nat;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::B;
use futures::future::join_all;
use ic_cdk_management_canister::CanisterInstallMode;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use local_user_index_canister::move_funds_from_old_canister::*;
use oc_error_codes::{OCError, OCErrorCode};
use std::cell::RefCell;
use std::collections::{BTreeSet, HashSet};
use tracing::{error, info};
use types::{BuildVersion, C2CError, CanisterId, CanisterWasmBytes, Cycles, TimestampNanos, UserIdAndPrincipal};
use utils::canister::{CanisterToInstall, WasmToInstall, is_invalid_controller_error};

const MAX_LEDGERS: usize = 100;
const MAX_CONCURRENT_TRANSFERS: usize = 10;
// The ledgers are chosen by the caller, so the calls to them must time out, lest one which never
// responds hold the move up, and stop this canister from being stopped to be upgraded
const LEDGER_CALL_TIMEOUT_SECONDS: u32 = 60;
// Each transfer in flight holds back the execution prepayment for the relay's update, and the
// reservation for the ledger's response and the callback which handles it
const CYCLES_REQUIRED_PER_TRANSFER: Cycles = 100 * B;

thread_local! {
    // The old canisters whose funds are being moved
    static IN_PROGRESS: RefCell<HashSet<CanisterId>> = RefCell::default();
}

// Moves the funds held by a migrated user's old canister to the user's wallet, by installing the
// call relay on the canister and making the transfers through it. The canister must have been
// uninstalled, which happens once the user has been switched over to their new id.
#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn move_funds_from_old_canister(args: Args) -> Response {
    let PrepareResult {
        old_canister_id,
        wallet,
        now_nanos,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };
    let Some(_guard) = InProgressGuard::new(old_canister_id) else {
        return Response::Error(OCErrorCode::AlreadyInProgress.with_message("Funds already being moved"));
    };

    let ledgers: BTreeSet<_> = args.ledgers.into_iter().collect();
    let (mut outcomes, transfers) = transfers_to_make(old_canister_id, ledgers).await;
    if transfers.is_empty() {
        return Response::Success(outcomes);
    }

    // The canister is kept out of the cycles refund queue while the relay is in use
    if let Err(error) = mutate_state(|state| take_from_refund_queue(state, old_canister_id)) {
        return Response::Error(error);
    }
    match install_relay(old_canister_id, transfers.len()).await {
        Ok(()) => {}
        Err(InstallError::NotController) => {
            return Response::Error(
                OCErrorCode::CanisterNotFound.with_message("Old canister not controlled by this LocalUserIndex"),
            );
        }
        Err(InstallError::Failed(error)) => {
            mutate_state(|state| queue_refund(state, old_canister_id));
            return Response::Error(error);
        }
    }

    for chunk in transfers.chunks(MAX_CONCURRENT_TRANSFERS) {
        let results = join_all(
            chunk
                .iter()
                .map(|transfer| make_transfer(old_canister_id, wallet, transfer, now_nanos)),
        )
        .await;
        outcomes.extend(results);
    }

    // If the relay can't be uninstalled the canister is left out of the refund queue, since its
    // refund would fail, until a later call picks up from here, finding the relay installed
    match utils::canister::uninstall(old_canister_id).await {
        Ok(()) => mutate_state(|state| queue_refund(state, old_canister_id)),
        Err(error) => error!(%old_canister_id, ?error, "Failed to uninstall the call relay"),
    }

    let moved = outcomes
        .iter()
        .filter(|o| matches!(o.result, MoveFundsResult::Moved { .. }))
        .count();
    info!(old_user_id = %args.old_user_id, moved, "Moved funds from migrated user's old canister");
    Response::Success(outcomes)
}

struct PrepareResult {
    old_canister_id: CanisterId,
    wallet: Account,
    now_nanos: TimestampNanos,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, OCError> {
    let Some(user) = state.data.global_users.get_by_principal(&state.env.caller()) else {
        return Err(OCErrorCode::InitiatorNotFound.into());
    };
    if state.data.migrated_user_ids.get(&args.old_user_id) != Some(user.user_id) {
        return Err(OCErrorCode::InitiatorNotAuthorized.with_message("Caller wasn't migrated from the old user id"));
    }
    if !args.old_user_id.is_canister() {
        return Err(OCErrorCode::InvalidRequest.with_message("Old user id wasn't a canister of its own"));
    }
    if state.data.local_users.contains(&args.old_user_id) {
        return Err(OCErrorCode::AlreadyInProgress.with_message("Old canister not yet uninstalled"));
    }
    if args.ledgers.len() > MAX_LEDGERS {
        return Err(OCErrorCode::InvalidRequest.with_message(format!("Too many ledgers, the maximum is {MAX_LEDGERS}")));
    }

    Ok(PrepareResult {
        old_canister_id: args.old_user_id.canister_id(),
        wallet: UserIdAndPrincipal::new(user.user_id, user.principal).into(),
        now_nanos: state.env.now_nanos(),
    })
}

struct Transfer {
    ledger: CanisterId,
    amount: u128,
    fee: u128,
}

// Works out how much can be moved on each ledger, which is the old canister's balance less the
// fee, returning the outcomes for the ledgers with nothing to move or where that can't be found
async fn transfers_to_make(old_canister_id: CanisterId, ledgers: BTreeSet<CanisterId>) -> (Vec<LedgerOutcome>, Vec<Transfer>) {
    let mut outcomes = Vec::new();
    let account = Account::from(old_canister_id);

    let balances = join_all(ledgers.iter().map(|ledger| balance_of(*ledger, account))).await;
    let mut with_balance = Vec::new();
    for (ledger, balance) in ledgers.into_iter().zip(balances) {
        match balance {
            Ok(0) => outcomes.push(LedgerOutcome {
                ledger,
                result: MoveFundsResult::NothingToMove,
            }),
            Ok(balance) => with_balance.push((ledger, balance)),
            Err(error) => outcomes.push(LedgerOutcome {
                ledger,
                result: MoveFundsResult::Failed(error.into()),
            }),
        }
    }

    let fees = join_all(with_balance.iter().map(|(ledger, _)| fee(*ledger))).await;
    let mut transfers = Vec::new();
    for ((ledger, balance), fee) in with_balance.into_iter().zip(fees) {
        match fee {
            Ok(fee) if balance > fee => transfers.push(Transfer {
                ledger,
                amount: balance - fee,
                fee,
            }),
            Ok(_) => outcomes.push(LedgerOutcome {
                ledger,
                result: MoveFundsResult::NothingToMove,
            }),
            Err(error) => outcomes.push(LedgerOutcome {
                ledger,
                result: MoveFundsResult::Failed(error.into()),
            }),
        }
    }

    (outcomes, transfers)
}

async fn balance_of(ledger: CanisterId, account: Account) -> Result<u128, C2CError> {
    canister_client::make_c2c_call(
        ledger,
        "icrc1_balance_of",
        &account,
        candid::encode_one,
        |r| candid::decode_one(r),
        Some(LEDGER_CALL_TIMEOUT_SECONDS),
    )
    .await
    .map(to_u128)
}

async fn fee(ledger: CanisterId) -> Result<u128, C2CError> {
    canister_client::make_c2c_call(
        ledger,
        "icrc1_fee",
        (),
        candid::encode_args,
        |r| candid::decode_one(r),
        Some(LEDGER_CALL_TIMEOUT_SECONDS),
    )
    .await
    .map(to_u128)
}

// The ledgers are chosen by the caller, so an amount which doesn't fit is saturated rather than
// trapping, and then fails at the ledger or is too small to move
fn to_u128(value: Nat) -> u128 {
    value.0.try_into().unwrap_or(u128::MAX)
}

// Makes the transfer as the old canister, through the relay. The fee is given so that the ledger
// rejects the transfer if it has changed, since the amount depends on it.
async fn make_transfer(
    old_canister_id: CanisterId,
    to: Account,
    transfer: &Transfer,
    now_nanos: TimestampNanos,
) -> LedgerOutcome {
    let args = TransferArg {
        from_subaccount: None,
        to,
        fee: Some(transfer.fee.into()),
        created_at_time: Some(now_nanos),
        memo: None,
        amount: transfer.amount.into(),
    };

    let result = match call_relay::call::<_, Result<Nat, TransferError>>(
        old_canister_id,
        transfer.ledger,
        "icrc1_transfer",
        &args,
        LEDGER_CALL_TIMEOUT_SECONDS,
    )
    .await
    {
        Ok(Ok(block_index)) => MoveFundsResult::Moved {
            amount: transfer.amount,
            fee: transfer.fee,
            block_index: block_index.0.try_into().unwrap_or_default(),
        },
        Ok(Err(error)) => MoveFundsResult::Failed(OCErrorCode::TransferFailed.with_message(format!("{error:?}"))),
        Err(error) => MoveFundsResult::Failed(error.into()),
    };

    LedgerOutcome {
        ledger: transfer.ledger,
        result,
    }
}

fn take_from_refund_queue(state: &mut RuntimeState, canister_id: CanisterId) -> Result<(), OCError> {
    if refund_cycles::is_in_progress(state, canister_id) {
        return Err(OCErrorCode::AlreadyInProgress.with_message("Old canister's cycles being refunded"));
    }
    state.data.cycles_refund_queue.retain(|c| c.canister_id != canister_id);
    Ok(())
}

// A canister which has already been refunded is quickly skipped, having too few cycles left
fn queue_refund(state: &mut RuntimeState, canister_id: CanisterId) {
    state.data.cycles_refund_queue.push_back(CanisterToRefund {
        canister_id,
        attempt: 0,
        retry_after: 0,
    });
    refund_cycles::start_job_if_required(state, None);
}

enum InstallError {
    NotController,
    Failed(OCError),
}

// Installs the relay on the old canister, first topping the canister up, if need be, with the
// cycles needed to install it and make the transfers through it. The relay is already installed
// if an earlier call failed to uninstall it.
async fn install_relay(canister_id: CanisterId, transfer_count: usize) -> Result<(), InstallError> {
    let status = utils::canister::canister_status(canister_id).await.map_err(|error| {
        if is_invalid_controller_error(error.reject_code(), error.message()) {
            InstallError::NotController
        } else {
            InstallError::Failed(error.into())
        }
    })?;

    let wasm = CanisterWasmBytes(call_relay::CALL_RELAY_WASM.to_vec());
    let already_installed = match &status.module_hash {
        None => false,
        Some(hash) if *hash == wasm.hash() => true,
        // Eg. the cycles refunder, while its refund is waiting to be retried
        Some(_) => {
            return Err(InstallError::Failed(
                OCErrorCode::AlreadyInProgress.with_message("Old canister has code installed"),
            ));
        }
    };

    let concurrent_transfers = transfer_count.min(MAX_CONCURRENT_TRANSFERS) as Cycles;
    let required =
        status.freezing_threshold_cycles() + CYCLES_REQUIRED_FOR_INSTALL + concurrent_transfers * CYCLES_REQUIRED_PER_TRANSFER;
    let balance = status.cycles();
    if balance < required {
        utils::canister::deposit_cycles(canister_id, required - balance)
            .await
            .map_err(|error| InstallError::Failed(error.into()))?;
    }

    if !already_installed {
        // `Install` mode fails if the canister has code, so a live canister can never be
        // overwritten, even if the status above is somehow stale
        utils::canister::install(CanisterToInstall {
            canister_id,
            current_wasm_version: BuildVersion::default(),
            new_wasm_version: BuildVersion::default(),
            args: Vec::new(),
            new_wasm: WasmToInstall::Default(wasm),
            deposit_cycles_if_needed: false,
            mode: CanisterInstallMode::Install,
            stop_start_canister: false,
        })
        .await
        .map_err(|error| InstallError::Failed(error.into()))?;
    }
    Ok(())
}

// Marks the old canister's funds as being moved while held
struct InProgressGuard(CanisterId);

impl InProgressGuard {
    fn new(canister_id: CanisterId) -> Option<InProgressGuard> {
        IN_PROGRESS
            .with_borrow_mut(|p| p.insert(canister_id))
            .then_some(InProgressGuard(canister_id))
    }
}

impl Drop for InProgressGuard {
    fn drop(&mut self) {
        IN_PROGRESS.with_borrow_mut(|p| p.remove(&self.0));
    }
}
