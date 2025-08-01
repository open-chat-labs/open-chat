use crate::timer_job_types::{ExpireSwapJob, TimerJob};
use crate::{Data, RuntimeState, deposit_address, mutate_state};
use candid::Principal;
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
    let caller = state.env.caller();

    if let Err(error) = validate_swap(&args, now, caller, &state.data) {
        return InvalidSwap(error);
    }

    let expires_at = args.expires_at;
    let token0_principal = args.token0_principal.unwrap_or(caller);
    let token1_principal = args.token1_principal;
    let id = state.data.swaps.push(caller, args, now);
    state
        .data
        .timer_jobs
        .enqueue_job(TimerJob::ExpireSwap(Box::new(ExpireSwapJob { swap_id: id })), expires_at, now);

    let escrow_canister_id = state.env.canister_id();

    Success(SuccessResult {
        id,
        token0_deposit_address: deposit_address(token0_principal, id, escrow_canister_id),
        token1_deposit_address: token1_principal.map(|principal| deposit_address(principal, id, escrow_canister_id)),
    })
}

fn validate_swap(args: &Args, now: TimestampMillis, caller: Principal, data: &Data) -> Result<(), String> {
    let offerer = args.token0_principal.unwrap_or(caller);

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
    } else if Some(offerer) == args.token1_principal {
        Err("The offerer cannot also be the accepter".to_string())
    } else {
        Ok(())
    }
}
