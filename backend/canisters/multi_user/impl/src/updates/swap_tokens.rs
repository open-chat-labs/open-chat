use crate::crypto::swap_subaccount;
use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::{ProcessTokenSwapJob, TimerJob};
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{MEMO_SWAP, NANOS_PER_MILLISECOND, SECOND_IN_MS};
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use ledger_utils::{icrc2_transfer_from, spender_subaccount, validate_from_account};
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::icrc1::Account;
use types::{Achievement, CanisterId, OCResult, TimestampMillis, Timestamped};
use user_canister::swap_tokens::{Response::*, *};
use user_core::TokenSwap;
use user_core::token_swaps::icpswap::ICPSwapClient;
use user_core::token_swaps::swap_client::SwapClient;

// The User canister's `swap_tokens`, for a user who holds their own funds in their own wallet. The
// input is pulled from the wallet (or the account the user names) via ICRC-2, against an approval
// made under the user's own spender subaccount, straight into the DEX's deposit account. The output
// (or a refund) is withdrawn from the DEX into this canister's subaccount for the user, and sent on
// from there to their wallet once the DEX has paid it out, which it does asynchronously.
//
// Only ICPSwap is supported so far. TACO pays its output to the default account of whoever swapped,
// so this canister would have to work out which of its users each payment was for.
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn swap_tokens(args: Args) -> Response {
    execute_update_async(|| swap_tokens_impl(args)).await
}

async fn swap_tokens_impl(args: Args) -> Response {
    let (user_index, token_swap) = match mutate_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    process_token_swap(user_index, token_swap, 0).await
}

fn prepare(mut args: Args, state: &mut RuntimeState) -> OCResult<(u16, TokenSwap)> {
    if !matches!(args.exchange_args, ExchangeArgs::ICPSwap(_)) {
        return Err(OCErrorCode::InvalidRequest.with_message("Only swaps via ICPSwap are supported by the MultiUser canister"));
    }
    validate_from_account(args.from_account, state.env.canister_id())?;
    let now = state.env.now();
    state.with_caller_user_mut(|user_index, user| {
        user.verify_not_suspended()?;
        user.pin_number.verify(args.pin.as_mut(), now)?;
        let token_swap = user.token_swaps.push_new(args, false, false, now);
        Ok((user_index, token_swap))
    })
}

pub(crate) async fn process_token_swap(user_index: u16, mut token_swap: TokenSwap, attempt: u32) -> Response {
    let args = token_swap.args.clone();
    // The user may have been deleted since the swap started, in which case there is nowhere to
    // record its progress
    let Some((this_canister_id, principal)) = read_state(|state| {
        state
            .data
            .users
            .with_user(user_index, |user| (state.env.canister_id(), user.principal))
    }) else {
        return Error(OCErrorCode::InitiatorNotFound.into());
    };
    let swap_client = build_swap_client(&args, this_canister_id, principal);

    let deposit_account = if let Some(a) = extract_result(&token_swap.deposit_account) {
        *a
    } else {
        match swap_client.deposit_account().await {
            Ok(a) => {
                token_swap.deposit_account = Some(Timestamped::new(Ok(a), now()));
                upsert(user_index, &token_swap);
                a
            }
            Err(error) => {
                let msg = format!("{error:?}");
                token_swap.deposit_account = Some(Timestamped::new(Err(msg.clone()), now()));
                token_swap.success = Some(Timestamped::new(false, now()));
                upsert(user_index, &token_swap);
                log_error("Failed to get deposit account", msg.as_str(), &args, attempt);
                return Error(error.into());
            }
        }
    };

    let amount_to_dex = args.input_amount.saturating_sub(args.input_token.fee);

    if extract_result(&token_swap.transfer_or_approval).is_none() {
        // The allowance is what authorises this - the ledger only lets us pull from an account which
        // has approved this canister as spender, under the user's own spender subaccount - so there
        // is nothing for us to check here. The fee is charged to the account pulled from, so this
        // takes `input_amount` from it, as the User canister's transfer to the DEX does.
        let result = icrc2_transfer_from(
            args.input_token.ledger,
            &TransferFromArgs {
                spender_subaccount: Some(spender_subaccount(principal)),
                from: args.from_account.unwrap_or(principal.into()).into(),
                to: deposit_account.into(),
                fee: Some(args.input_token.fee.into()),
                created_at_time: Some(now() * NANOS_PER_MILLISECOND),
                memo: Some(MEMO_SWAP.to_vec().into()),
                amount: amount_to_dex.into(),
            },
        )
        .await;

        match result {
            Ok(index) => {
                token_swap.transfer_or_approval = Some(Timestamped::new(Ok(index), now()));
                upsert(user_index, &token_swap);
            }
            Err(error) => {
                let msg = format!("{error:?}");
                token_swap.transfer_or_approval = Some(Timestamped::new(Err(msg.clone()), now()));
                token_swap.success = Some(Timestamped::new(false, now()));
                upsert(user_index, &token_swap);
                log_error("Failed to pull tokens from wallet", msg.as_str(), &args, attempt);
                return Error(error);
            }
        }
    }

    if extract_result(&token_swap.notified_dex_at).is_none() {
        if let Err(error) = swap_client.deposit(amount_to_dex).await {
            let msg = format!("{error:?}");
            token_swap.notified_dex_at = Some(Timestamped::new(Err(msg.clone()), now()));
            upsert_and_retry(user_index, &token_swap, attempt);
            log_error("Failed to deposit tokens", msg.as_str(), &args, attempt);
            return Error(error.into());
        } else {
            token_swap.notified_dex_at = Some(Timestamped::new(Ok(()), now()));
            upsert(user_index, &token_swap);
        }
    }

    let swap_result = if let Some(r) = extract_result(&token_swap.swap_result).cloned() {
        r
    } else {
        match swap_client
            .swap(
                amount_to_dex.saturating_sub(args.input_token.fee),
                args.min_output_amount,
                None,
            )
            .await
        {
            Ok(r) => {
                token_swap.swap_result = Some(Timestamped::new(Ok(r.clone()), now()));
                upsert(user_index, &token_swap);
                r
            }
            Err(error) => {
                let msg = format!("{error:?}");
                token_swap.swap_result = Some(Timestamped::new(Err(msg.clone()), now()));
                upsert_and_retry(user_index, &token_swap, attempt);
                log_error("Failed to swap tokens", msg.as_str(), &args, attempt);
                return Error(error.into());
            }
        }
    };

    // The amounts withdrawn are those the User canister withdraws
    let (successful_swap, amount_out) = if let Ok(amount_swapped) = &swap_result {
        (true, amount_swapped.amount_out.saturating_sub(args.output_token.fee))
    } else {
        (false, amount_to_dex.saturating_sub(args.input_token.fee))
    };
    let token = if successful_swap { &args.output_token } else { &args.input_token };

    if extract_result(&token_swap.withdrawn_from_dex_at).is_none() {
        match swap_client.withdraw(successful_swap, amount_out).await {
            Ok(_) => {
                token_swap.withdrawn_from_dex_at = Some(Timestamped::new(Ok(amount_out), now()));
                upsert(user_index, &token_swap);
                // The DEX pays out asynchronously, so the output is sent on to the user's wallet
                // once it has had time to arrive, however many attempts the swap has taken so far
                retry(user_index, &token_swap, attempt);
                return if successful_swap {
                    Success(SuccessResult { amount_out })
                } else {
                    Error(OCErrorCode::SwapFailed.into())
                };
            }
            Err(error) => {
                let msg = format!("{error:?}");
                token_swap.withdrawn_from_dex_at = Some(Timestamped::new(Err(msg.clone()), now()));
                upsert_and_retry(user_index, &token_swap, attempt);
                log_error("Failed to withdraw tokens", msg.as_str(), &args, attempt);
                return Error(error.into());
            }
        }
    }

    if extract_result(&token_swap.sent_to_wallet).is_none() {
        // The DEX pays `amount_out` less its fee into this canister's subaccount for the user, all of
        // which is sent on, less the fee for doing so. Each attempt is made at the time of the
        // withdrawal, so that the ledger rejects a repeat of a transfer which has already been made.
        let withdrawn_at = token_swap.withdrawn_from_dex_at.as_ref().map_or(0, |w| w.timestamp);
        let result = send_to_wallet(
            token.ledger,
            principal,
            amount_out.saturating_sub(2 * token.fee),
            token.fee,
            withdrawn_at,
        )
        .await;

        match result {
            Ok(index) => {
                let now = now();
                token_swap.sent_to_wallet = Some(Timestamped::new(Ok(index), now));
                token_swap.success = Some(Timestamped::new(successful_swap, now));
                upsert(user_index, &token_swap);
            }
            Err(error) => {
                // Until the DEX has paid out, there isn't enough to send on
                if !error.matches_code(OCErrorCode::InsufficientFunds) {
                    log_error("Failed to send tokens to wallet", &format!("{error:?}"), &args, attempt);
                }
                token_swap.sent_to_wallet = Some(Timestamped::new(Err(format!("{error:?}")), now()));
                upsert_and_retry(user_index, &token_swap, attempt);
                return Error(error);
            }
        }
    }

    if successful_swap {
        mutate_state(|state| {
            state.award_achievement_and_notify(user_index, Achievement::SwappedFromWallet, state.env.now());
            state.data.flush_pending_events();
        });
        Success(SuccessResult { amount_out })
    } else {
        Error(OCErrorCode::SwapFailed.into())
    }
}

fn build_swap_client(args: &Args, this_canister_id: CanisterId, principal: Principal) -> Box<dyn SwapClient> {
    let input_token = args.input_token.clone();
    let output_token = args.output_token.clone();

    match &args.exchange_args {
        ExchangeArgs::ICPSwap(icpswap) => {
            let (token0, token1) = if icpswap.zero_for_one { (input_token, output_token) } else { (output_token, input_token) };
            Box::new(
                ICPSwapClient::new(
                    this_canister_id,
                    icpswap.swap_canister_id,
                    token0,
                    token1,
                    icpswap.zero_for_one,
                )
                .with_withdrawal_subaccount(swap_subaccount(principal)),
            )
        }
        // Rejected by `prepare`
        _ => unreachable!(),
    }
}

// Sends what the DEX paid into this canister's subaccount for the user on to their wallet, returning
// the ledger block index. A transfer the ledger has already made is treated as made.
async fn send_to_wallet(
    ledger: CanisterId,
    principal: Principal,
    amount: u128,
    fee: u128,
    created_at: TimestampMillis,
) -> OCResult<u64> {
    let response = icrc_ledger_canister_c2c_client::icrc1_transfer(
        ledger,
        &TransferArg {
            from_subaccount: Some(swap_subaccount(principal)),
            to: Account::from(principal).into(),
            fee: Some(fee.into()),
            created_at_time: Some(created_at * NANOS_PER_MILLISECOND),
            memo: Some(MEMO_SWAP.to_vec().into()),
            amount: amount.into(),
        },
    )
    .await?;

    match response {
        Ok(index) => Ok(index.0.try_into().unwrap()),
        Err(TransferError::Duplicate { duplicate_of }) => Ok(duplicate_of.0.try_into().unwrap()),
        Err(TransferError::InsufficientFunds { .. }) => Err(OCErrorCode::InsufficientFunds.into()),
        Err(error) => Err(OCErrorCode::TransferFailed.with_json(&error)),
    }
}

fn now() -> TimestampMillis {
    read_state(|state| state.env.now())
}

// Does nothing if the user has been deleted since the swap started
fn upsert(user_index: u16, token_swap: &TokenSwap) {
    mutate_state(|state| {
        state
            .data
            .users
            .with_user_mut(user_index, |user| user.token_swaps.upsert(token_swap.clone()));
    });
}

// Records the swap's progress, and carries on with it shortly, unless it has been tried too often
fn upsert_and_retry(user_index: u16, token_swap: &TokenSwap, attempt: u32) {
    upsert(user_index, token_swap);
    if attempt < 20 {
        retry(user_index, token_swap, attempt);
    }
}

// Carries on with the swap shortly
fn retry(user_index: u16, token_swap: &TokenSwap, attempt: u32) {
    mutate_state(|state| {
        let now = state.env.now();
        state.data.timer_jobs.enqueue_job(
            TimerJob::ProcessTokenSwap(Box::new(ProcessTokenSwapJob {
                user_index,
                swap_id: token_swap.args.swap_id,
                attempt: attempt + 1,
            })),
            now + 5 * SECOND_IN_MS,
            now,
        );
    });
}

fn extract_result<T>(subtask: &Option<Timestamped<Result<T, String>>>) -> Option<&T> {
    subtask.as_ref().and_then(|t| t.value.as_ref().ok())
}

fn log_error(message: &str, error: &str, args: &Args, attempt: u32) {
    error!(
        swap_id = %args.swap_id,
        exchange_id = %args.exchange_args.exchange_id(),
        input_token = args.input_token.symbol,
        output_token = args.output_token.symbol,
        error,
        attempt,
        message
    );
}
