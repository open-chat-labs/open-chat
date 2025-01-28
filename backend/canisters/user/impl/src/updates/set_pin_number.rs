use crate::guards::caller_is_owner;
use crate::model::pin_number::VerifyPinError;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use identity_utils::extract_certificate;
use types::{Achievement, FieldTooLongResult, FieldTooShortResult};
use user_canister::set_pin_number::{Response::*, *};

const MIN_LENGTH: usize = 4;
const MAX_LENGTH: usize = 20;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_pin_number(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_pin_number_impl(args, state))
}

fn set_pin_number_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    if state.data.pin_number.enabled() {
        match args.verification {
            PinNumberVerification::None => return PinRequired,
            PinNumberVerification::PIN(attempt) => {
                if let Err(error) = state.data.pin_number.verify(Some(&attempt), now) {
                    return match error {
                        VerifyPinError::PinRequired => PinRequired,
                        VerifyPinError::PinIncorrect(delay) => PinIncorrect(delay),
                        VerifyPinError::TooManyFailedAttempted(delay) => TooManyFailedPinAttempts(delay),
                    };
                }
            }
            PinNumberVerification::Delegation(delegation) => {
                let certificate = match extract_certificate(&delegation.signature) {
                    Ok(c) => c,
                    Err(e) => return MalformedSignature(e),
                };

                let now_nanos = (now * NANOS_PER_MILLISECOND) as u128;
                let five_minutes = (5 * MINUTE_IN_MS * NANOS_PER_MILLISECOND) as u128;

                if ic_certificate_verification::validate_certificate_time(&certificate, &now_nanos, &five_minutes).is_err() {
                    return DelegationTooOld;
                };
            }
        }
    }

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

    state.data.pin_number.set(args.new.map(|p| p.into()), now);

    state.data.award_achievement_and_notify(Achievement::SetPin, now);

    Success
}
