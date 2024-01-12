use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use escrow_canister::create_offer::{Response::*, *};
use types::TimestampMillis;

#[update_candid_and_msgpack]
#[trace]
fn create_offer(args: Args) -> Response {
    mutate_state(|state| create_offer_impl(args, state))
}

fn create_offer_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    if let Err(error) = validate_offer(&args, now) {
        InvalidOffer(error)
    } else {
        let caller = state.env.caller().into();
        let id = state.data.offers.push(caller, args, now);

        Success(SuccessResult { id })
    }
}

fn validate_offer(args: &Args, now: TimestampMillis) -> Result<(), String> {
    if args.token0.ledger == args.token1.ledger {
        Err("Token0 must be different to token1".to_string())
    } else if args.token0_amount == 0 {
        Err("Token0 amount cannot be 0".to_string())
    } else if args.token1_amount == 0 {
        Err("Token1 amount cannot be 0".to_string())
    } else if args.expires_at < now {
        Err("Expiry cannot be in the past".to_string())
    } else {
        Ok(())
    }
}
