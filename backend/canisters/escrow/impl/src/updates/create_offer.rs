use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use escrow_canister::create_offer::{Response::*, *};
use types::TimestampMillis;

#[update_msgpack]
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
    if args.input_token.ledger == args.output_token.ledger {
        Err("Input token must be different to output token".to_string())
    } else if args.input_amount == 0 {
        Err("Input amount cannot be 0".to_string())
    } else if args.output_amount == 0 {
        Err("Output amount cannot be 0".to_string())
    } else if args.expires_at < now {
        Err("Expiry cannot be in the past".to_string())
    } else {
        Ok(())
    }
}
