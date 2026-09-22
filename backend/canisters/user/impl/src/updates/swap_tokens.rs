use crate::crypto::{icrc2_transfer_from, validate_from_account};
use crate::guards::caller_is_owner;
use crate::model::token_swaps::TokenSwap;
use crate::timer_job_types::{ProcessTokenSwapJob, TimerJob};
use crate::token_swaps::icpswap::ICPSwapClient;
use crate::token_swaps::swap_client::SwapClient;
use crate::token_swaps::taco::TacoExchangeClient;
use crate::{Data, RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{MEMO_SWAP, MEMO_SWAP_APPROVAL, NANOS_PER_MILLISECOND, SECOND_IN_MS};
use icrc_ledger_types::icrc1::transfer::TransferArg;
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use oc_error_codes::OCErrorCode;
use tracing::{error, info};
use types::icrc1::Account;
use types::{Achievement, OCResult, TimestampMillis, Timestamped, UserId};
use user_canister::swap_tokens::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn swap_tokens(args: Args) -> Response {
    execute_update_async(|| swap_tokens_impl(args)).await
}

async fn swap_tokens_impl(args: Args) -> Response {
    let (token_swap, swap_client) = match mutate_state(|state| prepare(args, state)) {
        Ok(ts) => ts,
        Err(response) => return Error(response),
    };

    process_token_swap(token_swap, Some(swap_client), 0, false).await
}

fn prepare(mut args: Args, state: &mut RuntimeState) -> OCResult<(TokenSwap, Box<dyn SwapClient>)> {
    state.data.user.verify_not_suspended()?;
    validate_from_account(args.from_account, state.env.canister_id().into())?;
    let now = state.env.now();
    state.data.user.pin_number.verify(args.pin.as_mut(), now)?;

    let swap_client = build_swap_client(&args, state);
    let token_swap = state
        .data
        .token_swaps
        .push_new(args, swap_client.use_icrc2(), swap_client.auto_withdrawals(), now);

    Ok((token_swap, swap_client))
}

pub(crate) async fn process_token_swap(
    mut token_swap: TokenSwap,
    swap_client: Option<Box<dyn SwapClient>>,
    attempt: u32,
    debug: bool,
) -> Response {
    if debug {
        info!(swap_id = %token_swap.args.swap_id, "Swap started");
    }

    let args = token_swap.args.clone();
    let swap_client = swap_client.unwrap_or_else(|| read_state(|state| build_swap_client(&args, state)));

    if let Some(from) = args.from_account
        && extract_result(&token_swap.funded_from_wallet).is_none()
    {
        // Pull the input from the wallet into the user's own account, after which the swap runs
        // exactly as if the funds had been there all along. Any refund therefore lands in the user's
        // OpenChat wallet too.
        let (my_user_id, now) = read_state(|state| (UserId::from(state.env.canister_id()), state.env.now()));
        let my_account = Account::for_user(my_user_id);
        // The allowance is what authorises this - the ledger only lets us pull from an account which
        // has approved this canister as spender - so there is nothing for us to check here.
        let result = icrc2_transfer_from(
            args.input_token.ledger,
            &TransferFromArgs {
                spender_subaccount: my_account.subaccount,
                from: from.into(),
                to: my_account.into(),
                fee: Some(args.input_token.fee.into()),
                created_at_time: Some(now * NANOS_PER_MILLISECOND),
                memo: Some(MEMO_SWAP.to_vec().into()),
                amount: args.input_amount.into(),
            },
        )
        .await;

        match result {
            Ok(index) => {
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.funded_from_wallet = Some(Timestamped::new(Ok(index), now));
                    state.data.token_swaps.upsert(token_swap.clone());
                });
            }
            Err(error) => {
                let msg = format!("{error:?}");
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.funded_from_wallet = Some(Timestamped::new(Err(msg.clone()), now));
                    token_swap.success = Some(Timestamped::new(false, now));
                    state.data.token_swaps.upsert(token_swap);
                });
                log_error("Failed to pull tokens from wallet", msg.as_str(), &args, attempt);
                return Error(error);
            }
        }
    }

    let icrc1_account = if token_swap.icrc2 {
        None
    } else if let Some(a) = extract_result(&token_swap.deposit_account) {
        Some(*a)
    } else {
        match swap_client.deposit_account().await {
            Ok(a) => {
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.deposit_account = Some(Timestamped::new(Ok(a), now));
                    state.data.token_swaps.upsert(token_swap.clone());
                });
                Some(a)
            }
            Err(error) => {
                let msg = format!("{error:?}");
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.deposit_account = Some(Timestamped::new(Err(msg.clone()), now));
                    token_swap.success = Some(Timestamped::new(false, now));
                    state.data.token_swaps.upsert(token_swap);
                });
                log_error("Failed to get deposit account", msg.as_str(), &args, attempt);
                return Error(error.into());
            }
        }
    };

    let amount_to_dex = args.input_amount.saturating_sub(args.input_token.fee);

    if extract_result(&token_swap.transfer_or_approval).is_none() {
        let now = read_state(|state| state.env.now());
        let transfer_or_approve_result = if let Some(account) = icrc1_account {
            match icrc_ledger_canister_c2c_client::icrc1_transfer(
                args.input_token.ledger,
                &TransferArg {
                    from_subaccount: None,
                    to: account.into(),
                    fee: Some(args.input_token.fee.into()),
                    created_at_time: Some(now * NANOS_PER_MILLISECOND),
                    memo: Some(MEMO_SWAP.to_vec().into()),
                    amount: amount_to_dex.into(),
                },
            )
            .await
            {
                Ok(Ok(index)) => Ok(index),
                Ok(Err(error)) => Err(OCErrorCode::TransferFailed.with_json(&error)),
                Err(error) => Err(error.into()),
            }
        } else {
            match icrc_ledger_canister_c2c_client::icrc2_approve(
                args.input_token.ledger,
                &ApproveArgs {
                    from_subaccount: None,
                    spender: swap_client.canister_id().into(),
                    amount: amount_to_dex.into(),
                    expected_allowance: None,
                    expires_at: None,
                    fee: Some(args.input_token.fee.into()),
                    memo: Some(MEMO_SWAP_APPROVAL.to_vec().into()),
                    created_at_time: Some(now * NANOS_PER_MILLISECOND),
                },
            )
            .await
            {
                Ok(Ok(index)) => Ok(index),
                Ok(Err(error)) => Err(OCErrorCode::ApprovalFailed.with_json(&error)),
                Err(error) => Err(error.into()),
            }
        };

        match transfer_or_approve_result {
            Ok(index) => {
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.transfer_or_approval = Some(Timestamped::new(Ok(index.0.try_into().unwrap()), now));
                    state.data.token_swaps.upsert(token_swap.clone());
                });
            }
            Err(error) => {
                let msg = format!("{error:?}");
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.transfer_or_approval = Some(Timestamped::new(Err(msg.clone()), now));
                    token_swap.success = Some(Timestamped::new(false, now));
                    state.data.token_swaps.upsert(token_swap);
                });
                log_error("Failed to transfer tokens", msg.as_str(), &args, attempt);
                return Error(error);
            }
        }
    }

    if !token_swap.icrc2 && extract_result(&token_swap.notified_dex_at).is_none() {
        if let Err(error) = swap_client.deposit(amount_to_dex).await {
            let msg = format!("{error:?}");
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.notified_dex_at = Some(Timestamped::new(Err(msg.clone()), now));
                state.data.token_swaps.upsert(token_swap.clone());
                enqueue_token_swap(token_swap, attempt, now, &mut state.data);
            });
            log_error("Failed to deposit tokens", msg.as_str(), &args, attempt);
            return Error(error.into());
        } else {
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.notified_dex_at = Some(Timestamped::new(Ok(()), now));
                state.data.token_swaps.upsert(token_swap.clone());
            });
        }
    }

    let swap_result = if let Some(r) = extract_result(&token_swap.swap_result).cloned() {
        r
    } else {
        let deposit_block_index = extract_result(&token_swap.transfer_or_approval).copied();
        match swap_client
            .swap(
                amount_to_dex.saturating_sub(args.input_token.fee),
                args.min_output_amount,
                deposit_block_index,
            )
            .await
        {
            Ok(r) => {
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.swap_result = Some(Timestamped::new(Ok(r.clone()), now));
                    if let Ok(swap_success) = &r
                        && matches!(swap_success.withdrawal_success, Some(true))
                    {
                        token_swap.withdrawn_from_dex_at = Some(Timestamped::new(Ok(swap_success.amount_out), now));
                    }
                    state.data.token_swaps.upsert(token_swap.clone());
                });
                r
            }
            Err(error) => {
                let msg = format!("{error:?}");
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.swap_result = Some(Timestamped::new(Err(msg.clone()), now));
                    state.data.token_swaps.upsert(token_swap.clone());
                    enqueue_token_swap(token_swap, attempt, now, &mut state.data);
                });
                log_error("Failed to swap tokens", msg.as_str(), &args, attempt);
                return Error(error.into());
            }
        }
    };

    let (successful_swap, amount_out) = if let Ok(amount_swapped) = swap_result {
        (true, amount_swapped.amount_out.saturating_sub(args.output_token.fee))
    } else {
        (false, amount_to_dex.saturating_sub(args.input_token.fee))
    };

    // Should we skip withdrawing if the swap failed, and it used ICRC2, and auto withdrawals
    // is false?
    if !swap_client.auto_withdrawals() && extract_result(&token_swap.withdrawn_from_dex_at).is_none() {
        if let Err(error) = swap_client.withdraw(successful_swap, amount_out).await {
            let msg = format!("{error:?}");
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.withdrawn_from_dex_at = Some(Timestamped::new(Err(msg.clone()), now));
                state.data.token_swaps.upsert(token_swap.clone());
                enqueue_token_swap(token_swap, attempt, now, &mut state.data);
            });
            log_error("Failed to withdraw tokens", msg.as_str(), &args, attempt);
            return Error(error.into());
        } else {
            mutate_state(|state| {
                mark_withdrawal_success(token_swap, successful_swap, amount_out, debug, state);
            })
        }
    }

    if successful_swap {
        mutate_state(|state| {
            state.award_achievement_and_notify(Achievement::SwappedFromWallet, state.env.now());
        });
        Success(SuccessResult { amount_out })
    } else {
        Error(OCErrorCode::SwapFailed.into())
    }
}

fn build_swap_client(args: &Args, state: &RuntimeState) -> Box<dyn SwapClient> {
    let this_canister_id = state.env.canister_id();
    let input_token = args.input_token.clone();
    let output_token = args.output_token.clone();

    match &args.exchange_args {
        ExchangeArgs::ICPSwap(icpswap) => {
            let (token0, token1) = if icpswap.zero_for_one { (input_token, output_token) } else { (output_token, input_token) };
            Box::new(ICPSwapClient::new(
                this_canister_id,
                icpswap.swap_canister_id,
                token0,
                token1,
                icpswap.zero_for_one,
            ))
        }
        ExchangeArgs::Taco(taco) => Box::new(TacoExchangeClient::new(
            taco.swap_canister_id,
            taco.treasury_canister_id,
            input_token,
            output_token,
        )),
        _ => unimplemented!(),
    }
}

pub(crate) fn mark_withdrawal_success(
    mut token_swap: TokenSwap,
    successful_swap: bool,
    amount_out: u128,
    debug: bool,
    state: &mut RuntimeState,
) {
    let now = state.env.now();
    token_swap.withdrawn_from_dex_at = Some(Timestamped::new(Ok(amount_out), now));
    token_swap.success = Some(Timestamped::new(successful_swap, now));

    if debug {
        info!(swap_id = %token_swap.args.swap_id, "Swap succeeded");
    }

    state.data.token_swaps.upsert(token_swap);
}

fn enqueue_token_swap(token_swap: TokenSwap, attempt: u32, now: TimestampMillis, data: &mut Data) {
    if attempt < 20 {
        data.timer_jobs.enqueue_job(
            TimerJob::ProcessTokenSwap(Box::new(ProcessTokenSwapJob {
                token_swap,
                attempt: attempt + 1,
                debug: false,
            })),
            now + 5 * SECOND_IN_MS,
            now,
        );
    }
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
