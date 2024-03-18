use crate::guards::caller_is_owner;
use crate::model::pin_number::VerifyPinError;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::set_pin_number::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn set_pin_number(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_pin_number_impl(args, state))
}

fn set_pin_number_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    if let Err(error) = state.data.pin_number.verify(args.current.as_deref(), now) {
        match error {
            VerifyPinError::PinRequired => PinRequired,
            VerifyPinError::PinIncorrect(delay) => PinIncorrect(delay),
            VerifyPinError::TooManyFailedAttempted(delay) => TooManyFailedPinAttempts(delay),
        }
    } else {
        state.data.pin_number.set(args.new, now);
        Success
    }
}
