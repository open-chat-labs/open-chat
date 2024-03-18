use crate::guards::caller_is_owner;
use crate::model::pin_number::VerifyPinError;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{FieldTooLongResult, FieldTooShortResult};
use user_canister::set_pin_number::{Response::*, *};

const MIN_LENGTH: usize = 4;
const MAX_LENGTH: usize = 20;

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
        if let Some(new) = args.new.as_ref() {
            let length = new.len();
            if length < MIN_LENGTH {
                return TooShort(FieldTooShortResult {
                    length_provided: length as u32,
                    min_length: MIN_LENGTH as u32,
                });
            }
            if length > MAX_LENGTH {
                return TooLong(FieldTooLongResult {
                    length_provided: length as u32,
                    max_length: MAX_LENGTH as u32,
                });
            }
        }

        state.data.pin_number.set(args.new, now);
        Success
    }
}
