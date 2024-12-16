use crate::timer_job_types::{ExpireSwapJob, TimerJob};
use crate::{mutate_state, Data, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::create_swap::{Response::*, *};
use types::TimestampMillis;

#[update(candid = true, msgpack = true)]
#[trace]
fn create_swap(args: Args) -> Response {
    mutate_state(|state| create_swap_impl(args, state))
}

fn create_swap_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    if let Err(error) = validate_swap(&args, now, &state.data) {
        InvalidSwap(error)
    } else {
        let caller = state.env.caller().into();
        let expires_at = args.expires_at;
        let id = state.data.swaps.push(caller, args, now);
        state
            .data
            .timer_jobs
            .enqueue_job(TimerJob::ExpireSwap(Box::new(ExpireSwapJob { swap_id: id })), expires_at, now);

        Success(SuccessResult { id })
    }
}

fn validate_swap(args: &Args, now: TimestampMillis, data: &Data) -> Result<(), String> {
    if args.token0.ledger == args.token1.ledger {
        Err("Input token must be different to output token".to_string())
    } else if args.token0_amount == 0 {
        Err("Input amount cannot be 0".to_string())
    } else if args.token1_amount == 0 {
        Err("Output amount cannot be 0".to_string())
    } else if args.expires_at < now {
        Err("Expiry cannot be in the past".to_string())
    } else if data.disabled_tokens.contains(&args.token0.ledger) {
        Err("Input token is disabled for swaps".to_string())
    } else if data.disabled_tokens.contains(&args.token1.ledger) {
        Err("Output token is disabled for swaps".to_string())
    } else {
        Ok(())
    }
}
