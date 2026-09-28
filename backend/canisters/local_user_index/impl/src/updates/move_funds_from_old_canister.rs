use crate::guards::caller_is_openchat_user;
use crate::jobs::refund_cycles::{self, CYCLES_REQUIRED_FOR_INSTALL};
use crate::{CanisterToRefund, RuntimeState, call_relay, mutate_state, read_state};
use candid::de::DecoderConfig;
use candid::{CandidType, Nat};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::B;
use futures::future::join_all;
use ic_cdk::call::RejectCode;
use ic_cdk_management_canister::CanisterInstallMode;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use local_user_index_canister::move_funds_from_old_canister::*;
use oc_error_codes::{OCError, OCErrorCode};
use serde::Deserialize;
use std::collections::BTreeSet;
use tracing::{error, info};
use types::{BuildVersion, C2CError, CanisterId, Cycles, TimestampNanos, UserIdAndPrincipal};
use utils::canister::{CanisterStatusMinimal, CanisterToInstall, WasmToInstall, is_invalid_controller_error};

// The ledgers are chosen by the caller, so they may be anything, eg. canisters which never respond,
// or which reply with candid which is costly to decode. So each call to one times out, the calls
// are made in a bounded number of rounds, and their replies are decoded within a quota. That way
// a call can't hold up the move, nor keep this canister from being stopped to be upgraded, for
// longer than the 3 minutes the rounds take at most.
const MAX_LEDGERS: usize = 20;
const MAX_CONCURRENT_TRANSFERS: usize = 10;
const LEDGER_CALL_TIMEOUT_SECONDS: u32 = 30;
// The relay's own call to the ledger only times out after 5 minutes, but an honest ledger's reply
// comes back through the relay well within this
const RELAY_CALL_TIMEOUT_SECONDS: u32 = 60;
const DECODING_QUOTA: usize = 100_000;
const SKIPPING_QUOTA: usize = 10_000;
// Each transfer in flight holds back the execution prepayment for the relay's update, and the
// reservation for the ledger's response and the callback which handles it
const CYCLES_REQUIRED_PER_TRANSFER: Cycles = 100 * B;

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
        guard,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let (status, relay_installed) = match old_canister_status(old_canister_id).await {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let ledgers: BTreeSet<_> = args.ledgers.into_iter().collect();
    let (mut outcomes, transfers) = transfers_to_make(old_canister_id, ledgers).await;

    if !transfers.is_empty() || relay_installed {
        // Once the move is done, and the canister no longer reserved, the refund job uninstalls
        // the relay if it is still installed and refunds the canister's cycles, whatever happens
        // from here on
        mutate_state(|state| queue_refund(state, old_canister_id));
    }

    let response = if transfers.is_empty() {
        Response::Success(outcomes)
    } else {
        match install_relay(old_canister_id, &status, relay_installed, transfers.len()).await {
            Ok(()) => {
                for chunk in transfers.chunks(MAX_CONCURRENT_TRANSFERS) {
                    let results = join_all(
                        chunk
                            .iter()
                            .map(|transfer| make_transfer(old_canister_id, wallet, transfer, now_nanos)),
                    )
                    .await;
                    outcomes.extend(results);
                }

                if let Err(error) = utils::canister::uninstall(old_canister_id).await {
                    error!(%old_canister_id, ?error, "Failed to uninstall the call relay, the refund job will retry");
                }

                let moved = outcomes
                    .iter()
                    .filter(|o| matches!(o.result, MoveFundsResult::Moved { .. }))
                    .count();
                info!(old_user_id = %args.old_user_id, moved, "Moved funds from migrated user's old canister");
                Response::Success(outcomes)
            }
            Err(error) => Response::Error(error),
        }
    };

    drop(guard);
    mutate_state(|state| refund_cycles::start_job_if_required(state, None));
    response
}

struct PrepareResult {
    old_canister_id: CanisterId,
    wallet: Account,
    now_nanos: TimestampNanos,
    guard: call_relay::InUseGuard,
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
    if args.ledgers.len() > MAX_LEDGERS {
        return Err(OCErrorCode::InvalidRequest.with_message(format!("Too many ledgers, the maximum is {MAX_LEDGERS}")));
    }
    if state.data.local_users.contains(&args.old_user_id) {
        return Err(OCErrorCode::AlreadyInProgress.with_message("Old canister not yet uninstalled"));
    }

    let old_canister_id = args.old_user_id.canister_id();
    if refund_cycles::is_in_progress(state, old_canister_id) {
        return Err(OCErrorCode::AlreadyInProgress.with_message("Old canister's cycles being refunded"));
    }
    // Held until the move is done, during which the refund job leaves the canister alone
    let Some(guard) = call_relay::InUseGuard::new(old_canister_id) else {
        return Err(OCErrorCode::AlreadyInProgress.with_message("Funds already being moved"));
    };

    Ok(PrepareResult {
        old_canister_id,
        wallet: UserIdAndPrincipal::new(user.user_id, user.principal).into(),
        now_nanos: state.env.now_nanos(),
        guard,
    })
}

// The old canister's status, and whether the relay is installed on it, which it may still be if an
// earlier move failed to uninstall it. Otherwise it must have no code installed. Its code doesn't
// change while it is reserved, since only the refund job and this install any.
async fn old_canister_status(canister_id: CanisterId) -> Result<(CanisterStatusMinimal, bool), OCError> {
    let status = utils::canister::canister_status(canister_id).await.map_err(|error| {
        if is_invalid_controller_error(error.reject_code(), error.message()) {
            OCErrorCode::CanisterNotFound.with_message("Old canister not controlled by this LocalUserIndex")
        } else {
            error.into()
        }
    })?;

    let relay_installed = match &status.module_hash {
        None => false,
        Some(hash) if *hash == call_relay::wasm().hash() => true,
        // Eg. the cycles refunder, while its refund is waiting to be retried
        Some(_) => return Err(OCErrorCode::AlreadyInProgress.with_message("Old canister has code installed")),
    };
    Ok((status, relay_installed))
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
    let method = "icrc1_balance_of";
    let reply = canister_client::make_c2c_call_raw(
        ledger,
        method,
        &candid::encode_one(account).unwrap(),
        0,
        Some(LEDGER_CALL_TIMEOUT_SECONDS),
    )
    .await?;
    decode_untrusted(ledger, method, &reply).map(to_u128)
}

async fn fee(ledger: CanisterId) -> Result<u128, C2CError> {
    let method = "icrc1_fee";
    let reply = canister_client::make_c2c_call_raw(
        ledger,
        method,
        &candid::encode_args(()).unwrap(),
        0,
        Some(LEDGER_CALL_TIMEOUT_SECONDS),
    )
    .await?;
    decode_untrusted(ledger, method, &reply).map(to_u128)
}

fn decode_untrusted<T: CandidType + for<'de> Deserialize<'de>>(
    canister_id: CanisterId,
    method: &str,
    bytes: &[u8],
) -> Result<T, C2CError> {
    let mut config = DecoderConfig::new();
    config
        .set_decoding_quota(DECODING_QUOTA)
        .set_skipping_quota(SKIPPING_QUOTA)
        .set_full_error_message(false);
    candid::decode_one_with_config(bytes, &config)
        .map_err(|error| C2CError::new(canister_id, method, RejectCode::CanisterReject, error.to_string()))
}

// An amount which doesn't fit is saturated rather than trapping, and then fails at the ledger or
// is too small to move
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
    let method = "icrc1_transfer";
    let args = TransferArg {
        from_subaccount: None,
        to,
        fee: Some(transfer.fee.into()),
        created_at_time: Some(now_nanos),
        memo: None,
        amount: transfer.amount.into(),
    };

    let response = call_relay::call(
        old_canister_id,
        transfer.ledger,
        method,
        &candid::encode_one(&args).unwrap(),
        RELAY_CALL_TIMEOUT_SECONDS,
    )
    .await
    .and_then(|reply| decode_untrusted::<Result<Nat, TransferError>>(transfer.ledger, method, &reply));

    let result = match response {
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

// Queues the canister's cycles to be refunded, unless they already are. A canister which has
// already been refunded is quickly skipped, having too few cycles left to be worth it.
fn queue_refund(state: &mut RuntimeState, canister_id: CanisterId) {
    let queue = &mut state.data.cycles_refund_queue;
    if !queue.iter().any(|c| c.canister_id == canister_id) {
        queue.push_back(CanisterToRefund {
            canister_id,
            attempt: 0,
            retry_after: 0,
        });
    }
}

// Installs the relay on the old canister, first topping the canister up, if need be, with the
// cycles needed to install it and make the transfers through it. The top up comes back when the
// canister's cycles are refunded.
async fn install_relay(
    canister_id: CanisterId,
    status: &CanisterStatusMinimal,
    already_installed: bool,
    transfer_count: usize,
) -> Result<(), OCError> {
    let concurrent_transfers = transfer_count.min(MAX_CONCURRENT_TRANSFERS) as Cycles;
    let required =
        status.freezing_threshold_cycles() + CYCLES_REQUIRED_FOR_INSTALL + concurrent_transfers * CYCLES_REQUIRED_PER_TRANSFER;
    let balance = status.cycles();
    if balance < required {
        let top_up = required - balance;
        utils::canister::deposit_cycles(canister_id, top_up).await?;
        mutate_state(|state| state.data.cycles_topped_up_for_refunds += top_up);
    }

    if !already_installed {
        // `Install` mode fails if the canister has code, so a live canister can never be
        // overwritten, even if the status above is somehow stale
        utils::canister::install(CanisterToInstall {
            canister_id,
            current_wasm_version: BuildVersion::default(),
            new_wasm_version: BuildVersion::default(),
            args: Vec::new(),
            new_wasm: WasmToInstall::Default(call_relay::wasm()),
            deposit_cycles_if_needed: false,
            mode: CanisterInstallMode::Install,
            stop_start_canister: false,
        })
        .await?;
    }
    Ok(())
}
