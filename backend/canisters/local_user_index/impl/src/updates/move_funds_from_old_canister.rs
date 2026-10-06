use crate::guards::caller_is_openchat_user;
use crate::jobs::refund_cycles::{self, CYCLES_REQUIRED_FOR_INSTALL};
use crate::{CanisterToRefund, RuntimeState, call_relay, mutate_state, read_state};
use candid::de::DecoderConfig;
use candid::{CandidType, Nat};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{B, min_cycles_balance};
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
use utils::cycles::can_spend_cycles;

// Only ledgers known to the Registry are called, but they are still outside our control, so to be
// safe each call to one times out, the calls are made in a bounded number of rounds, and their
// replies are decoded within a quota. That way a ledger which misbehaves can't hold up the move,
// nor keep this canister from being stopped to be upgraded, for longer than the rounds take at
// most: 30s for the balances, then for each of the 2 rounds of transfers, 30s for a transfer and
// 30s for its retry, 2.5 minutes in all, well within the 5 minutes a stop is given.
const MAX_LEDGERS: usize = 20;
const MAX_CONCURRENT_TRANSFERS: usize = 10;
const LEDGER_CALL_TIMEOUT_SECONDS: u32 = 30;
// The relay's own call to the ledger only times out after 5 minutes, but an honest ledger's reply
// comes back through the relay well within this
const RELAY_CALL_TIMEOUT_SECONDS: u32 = 30;
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
        ledgers,
        unknown_ledgers,
        guard,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let (status, relay_installed) = match old_canister_status(old_canister_id).await {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let (mut outcomes, transfers) = transfers_to_make(old_canister_id, ledgers).await;
    outcomes.extend(unknown_ledgers.into_iter().map(|ledger| LedgerOutcome {
        ledger,
        result: MoveFundsResult::Failed(OCErrorCode::LedgerNotFound.with_message("Ledger not known to the Registry")),
    }));

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
    // The ledgers known to the Registry, with their fees
    ledgers: Vec<(CanisterId, u128)>,
    unknown_ledgers: Vec<CanisterId>,
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
    if state.data.registry_tokens.is_empty() {
        return Err(OCErrorCode::NotInitialized.with_message("Tokens not yet loaded from the Registry"));
    }

    let old_canister_id = args.old_user_id.canister_id();
    if refund_cycles::is_in_progress(state, old_canister_id) {
        return Err(OCErrorCode::AlreadyInProgress.with_message("Old canister's cycles being refunded"));
    }
    // Held until the move is done, during which the refund job leaves the canister alone
    let Some(guard) = call_relay::InUseGuard::new(old_canister_id) else {
        return Err(OCErrorCode::AlreadyInProgress.with_message("Funds already being moved"));
    };

    let mut ledgers = Vec::new();
    let mut unknown_ledgers = Vec::new();
    for ledger in args.ledgers.iter().copied().collect::<BTreeSet<_>>() {
        match state.data.registry_tokens.fee(&ledger) {
            Some(fee) => ledgers.push((ledger, fee)),
            None => unknown_ledgers.push(ledger),
        }
    }

    Ok(PrepareResult {
        old_canister_id,
        wallet: UserIdAndPrincipal::new(user.user_id, user.principal).into(),
        now_nanos: state.env.now_nanos(),
        ledgers,
        unknown_ledgers,
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
    balance: u128,
    fee: u128,
}

// Looks up the old canister's balance on each ledger, returning the transfers of those with a
// balance which exceeds the fee, and the outcomes for the rest
async fn transfers_to_make(
    old_canister_id: CanisterId,
    ledgers: Vec<(CanisterId, u128)>,
) -> (Vec<LedgerOutcome>, Vec<Transfer>) {
    let account = Account::from(old_canister_id);
    let balances = join_all(ledgers.iter().map(|(ledger, _)| balance_of(*ledger, account))).await;

    let mut outcomes = Vec::new();
    let mut transfers = Vec::new();
    for ((ledger, fee), balance) in ledgers.into_iter().zip(balances) {
        match balance {
            Ok(balance) if balance > fee => transfers.push(Transfer { ledger, balance, fee }),
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

// Makes the transfer as the old canister, through the relay, of the balance less the fee. The fee
// is the Registry's, which may be out of date, in which case the ledger rejects the transfer with
// the fee it expects, and the transfer is tried once more with that fee.
async fn make_transfer(
    old_canister_id: CanisterId,
    to: Account,
    transfer: &Transfer,
    now_nanos: TimestampNanos,
) -> LedgerOutcome {
    let mut fee = transfer.fee;
    let mut response = relay_transfer(old_canister_id, to, transfer, fee, now_nanos).await;
    if let Ok(Err(TransferError::BadFee { expected_fee })) = &response {
        fee = to_u128(expected_fee.clone());
        if transfer.balance <= fee {
            return LedgerOutcome {
                ledger: transfer.ledger,
                result: MoveFundsResult::NothingToMove,
            };
        }
        response = relay_transfer(old_canister_id, to, transfer, fee, now_nanos).await;
    }

    let result = match response {
        Ok(Ok(block_index)) => MoveFundsResult::Moved {
            amount: transfer.balance - fee,
            fee,
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

async fn relay_transfer(
    old_canister_id: CanisterId,
    to: Account,
    transfer: &Transfer,
    fee: u128,
    now_nanos: TimestampNanos,
) -> Result<Result<Nat, TransferError>, C2CError> {
    let method = "icrc1_transfer";
    let args = TransferArg {
        from_subaccount: None,
        to,
        fee: Some(fee.into()),
        created_at_time: Some(now_nanos),
        memo: None,
        amount: (transfer.balance - fee).into(),
    };

    let reply = call_relay::call(
        old_canister_id,
        transfer.ledger,
        method,
        &candid::encode_one(&args).unwrap(),
        RELAY_CALL_TIMEOUT_SECONDS,
    )
    .await?;
    decode_untrusted(transfer.ledger, method, &reply)
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
            return_to_pool: false,
        });
    }
}

// Installs the relay on the old canister, first topping the canister up, if need be, with the
// cycles needed to install it and make the transfers through it. The top up comes back when the
// canister's cycles are refunded. The canister's freezing threshold is left out, since it holds
// back next to nothing for an uninstalled canister, which uses next to no memory, and is 0 once
// the canister's cycles have been refunded.
async fn install_relay(
    canister_id: CanisterId,
    status: &CanisterStatusMinimal,
    already_installed: bool,
    transfer_count: usize,
) -> Result<(), OCError> {
    let concurrent_transfers = transfer_count.min(MAX_CONCURRENT_TRANSFERS) as Cycles;
    let required = CYCLES_REQUIRED_FOR_INSTALL + concurrent_transfers * CYCLES_REQUIRED_PER_TRANSFER;
    let balance = status.cycles();
    if balance < required {
        let top_up = required - balance;
        if !read_state(|state| can_spend_cycles(top_up, min_cycles_balance(state.data.test_mode))) {
            return Err(OCErrorCode::CyclesBalanceTooLow.into());
        }
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
            top_up_keeping_balance_above: None,
            mode: CanisterInstallMode::Install,
            stop_start_canister: false,
        })
        .await?;
    }
    Ok(())
}
