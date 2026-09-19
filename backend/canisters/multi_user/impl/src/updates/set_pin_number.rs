use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{Achievement, FieldTooLongResult, FieldTooShortResult};
use user_canister::set_pin_number::*;

const MIN_LENGTH: usize = 4;
const MAX_LENGTH: usize = 20;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn set_pin_number(args: Args) -> Response {
    // TODO: This is async because verifying by reauthenticating calls the LocalUserIndex, as in the
    // User canister, which isn't supported yet
    mutate_state(|state| set_pin_number_impl(args, state))
}

fn set_pin_number_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    let result = state.with_caller_user_mut(|my_index, user| {
        if user.pin_number.enabled() {
            match args.verification {
                PinNumberVerification::None => return Err(Response::Error(OCErrorCode::PinRequired.into())),
                PinNumberVerification::PIN(mut attempt) => {
                    if let Err(error) = user.pin_number.verify(Some(&mut attempt), now) {
                        return Err(Response::Error(error.into()));
                    }
                }
                PinNumberVerification::Reauthenticated(_) => {
                    // TODO: The LocalUserIndex's `c2c_verify_sign_in_proof` identifies the user by
                    // the canister calling it, so it needs to take the user id before a user in
                    // this canister can be verified this way
                    return Err(Response::Error(OCErrorCode::InvalidRequest.with_message(
                        "Verifying by reauthenticating is not yet supported by the MultiUser canister",
                    )));
                }
            }
        }

        if let Some(new) = args.new.as_ref() {
            let length = new.len();
            if length < MIN_LENGTH {
                return Err(Response::Error(OCErrorCode::PinTooShort.with_json(&FieldTooShortResult {
                    length_provided: length as u32,
                    min_length: MIN_LENGTH as u32,
                })));
            }
            if length > MAX_LENGTH {
                return Err(Response::Error(OCErrorCode::PinTooLong.with_json(&FieldTooLongResult {
                    length_provided: length as u32,
                    max_length: MAX_LENGTH as u32,
                })));
            }
        }

        user.pin_number.set(args.new.map(|mut p| p.consume()), now);
        Ok(my_index)
    });

    match result {
        Ok(my_index) => {
            state.award_achievement_and_notify(my_index, Achievement::SetPin, now);
            Response::Success
        }
        Err(response) => response,
    }
}
