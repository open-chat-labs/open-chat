use crate::guards::caller_is_owner;
use crate::model::pin_number::VerifyPinError;
use crate::model::token_swaps::TokenSwap;
use crate::timer_job_types::{ProcessTokenSwapJob, TimerJob};
use crate::token_swaps::icpswap::ICPSwapClient;
use crate::token_swaps::sonic::SonicClient;
use crate::token_swaps::swap_client::SwapClient;
use crate::{mutate_state, read_state, run_regular_jobs, Data, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use tracing::{error, info};
use types::{TimestampMillis, Timestamped};
use user_canister::swap_tokens::{Response::*, *};
use utils::consts::MEMO_SWAP;
use utils::time::{NANOS_PER_MILLISECOND, SECOND_IN_MS};

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
#[trace]
async fn swap_tokens(args: Args) -> Response {
    run_regular_jobs();

    let token_swap = match mutate_state(|state| prepare(args, state)) {
        Ok(ts) => ts,
        Err(response) => return response,
    };

    process_token_swap(token_swap, 0, false).await
}

fn prepare(args: Args, state: &mut RuntimeState) -> Result<TokenSwap, Response> {
    let now = state.env.now();

    if let Err(error) = state.data.pin_number.verify(args.pin.as_deref(), now) {
        return Err(match error {
            VerifyPinError::PinRequired => PinRequired,
            VerifyPinError::PinIncorrect(delay) => PinIncorrect(delay),
            VerifyPinError::TooManyFailedAttempted(delay) => TooManyFailedPinAttempts(delay),
        });
    }

    Ok(state.data.token_swaps.push_new(args, now))
}

pub(crate) async fn process_token_swap(mut token_swap: TokenSwap, attempt: u32, debug: bool) -> Response {
    if debug {
        info!(swap_id = %token_swap.args.swap_id, "Swap started");
    }

    let args = token_swap.args.clone();
    let swap_client = read_state(|state| build_swap_client(&args, state));

    let account = if let Some(a) = extract_result(&token_swap.deposit_account) {
        *a
    } else {
        match swap_client.deposit_account().await {
            Ok(a) => {
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.deposit_account = Some(Timestamped::new(Ok(a), now));
                    state.data.token_swaps.upsert(token_swap.clone());
                });
                a
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
                return InternalError(msg);
            }
        }
    };

    let amount_to_dex = args.input_amount.saturating_sub(args.input_token.fee);

    if extract_result(&token_swap.transfer).is_none() {
        let now = read_state(|state| state.env.now());
        let transfer_result = match icrc_ledger_canister_c2c_client::icrc1_transfer(
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
            Ok(Err(error)) => Err(format!("{error:?}")),
            Err(error) => Err(format!("{error:?}")),
        };

        match transfer_result {
            Ok(index) => {
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.transfer = Some(Timestamped::new(Ok(index.0.try_into().unwrap()), now));
                    state.data.token_swaps.upsert(token_swap.clone());
                });
            }
            Err(msg) => {
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.transfer = Some(Timestamped::new(Err(msg.clone()), now));
                    token_swap.success = Some(Timestamped::new(false, now));
                    state.data.token_swaps.upsert(token_swap);
                });
                log_error("Failed to transfer tokens", msg.as_str(), &args, attempt);
                return InternalError(msg);
            }
        }
    }

    if extract_result(&token_swap.notified_dex_at).is_none() {
        if let Err(error) = swap_client.deposit(amount_to_dex).await {
            let msg = format!("{error:?}");
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.notified_dex_at = Some(Timestamped::new(Err(msg.clone()), now));
                state.data.token_swaps.upsert(token_swap.clone());
                enqueue_token_swap(token_swap, attempt, now, &mut state.data);
            });
            log_error("Failed to deposit tokens", msg.as_str(), &args, attempt);
            return InternalError(msg);
        } else {
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.notified_dex_at = Some(Timestamped::new(Ok(()), now));
                state.data.token_swaps.upsert(token_swap.clone());
            });
        }
    }

    let swap_result = if let Some(a) = extract_result(&token_swap.amount_swapped).cloned() {
        a
    } else {
        match swap_client
            .swap(amount_to_dex.saturating_sub(args.input_token.fee), args.min_output_amount)
            .await
        {
            Ok(a) => {
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.amount_swapped = Some(Timestamped::new(Ok(a.clone()), now));
                    state.data.token_swaps.upsert(token_swap.clone());
                });
                a
            }
            Err(error) => {
                let msg = format!("{error:?}");
                mutate_state(|state| {
                    let now = state.env.now();
                    token_swap.amount_swapped = Some(Timestamped::new(Err(msg.clone()), now));
                    state.data.token_swaps.upsert(token_swap.clone());
                    enqueue_token_swap(token_swap, attempt, now, &mut state.data);
                });
                log_error("Failed to swap tokens", msg.as_str(), &args, attempt);
                return InternalError(msg);
            }
        }
    };

    let (successful_swap, amount_out) = if let Ok(amount_swapped) = swap_result {
        (true, amount_swapped.saturating_sub(args.output_token.fee))
    } else {
        (false, amount_to_dex.saturating_sub(args.input_token.fee))
    };

    if extract_result(&token_swap.withdrawn_from_dex_at).is_none() {
        if let Err(error) = swap_client.withdraw(successful_swap, amount_out).await {
            let msg = format!("{error:?}");
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.withdrawn_from_dex_at = Some(Timestamped::new(Err(msg.clone()), now));
                state.data.token_swaps.upsert(token_swap.clone());
                enqueue_token_swap(token_swap, attempt, now, &mut state.data);
            });
            log_error("Failed to withdraw tokens", msg.as_str(), &args, attempt);
            return InternalError(msg);
        } else {
            mutate_state(|state| {
                let now = state.env.now();
                token_swap.withdrawn_from_dex_at = Some(Timestamped::new(Ok(amount_out), now));
                token_swap.success = Some(Timestamped::new(successful_swap, now));

                if debug {
                    info!(swap_id = %token_swap.args.swap_id, "Swap succeeded");
                }

                state.data.token_swaps.upsert(token_swap);
            });
        }
    }

    if successful_swap {
        Success(SuccessResult { amount_out })
    } else {
        SwapFailed
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
        ExchangeArgs::Sonic(sonic) => {
            let (token0, token1) = if sonic.zero_for_one { (input_token, output_token) } else { (output_token, input_token) };
            Box::new(SonicClient::new(
                this_canister_id,
                sonic.swap_canister_id,
                token0,
                token1,
                sonic.zero_for_one,
            ))
        }
        ExchangeArgs::KongSwap(_) => unimplemented!(),
    }
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
        input_token = args.input_token.token.token_symbol(),
        output_token = args.output_token.token.token_symbol(),
        error,
        attempt,
        message
    );
}
