use crate::guards::caller_is_admin;
use crate::{mutate_state, RewardCodes, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use icp_dispenser_bot::add_reward_codes::{Response::*, *};

#[update(guard = "caller_is_admin")]
#[trace]
fn add_reward_codes(args: Args) -> Response {
    if args.codes.iter().all(|c| RewardCodes::validate(c)) {
        mutate_state(|state| add_reward_codes_impl(args, state))
    } else {
        InvalidCodes
    }
}

fn add_reward_codes_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();

    for code in args.codes {
        state
            .data
            .reward_codes
            .add(code.to_ascii_uppercase(), args.reward_amount, caller, args.expiry, now);
    }
    Success
}
