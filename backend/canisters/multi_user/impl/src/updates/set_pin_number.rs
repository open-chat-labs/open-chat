use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
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
    execute_update_async(|| set_pin_number_impl(args)).await
}

async fn set_pin_number_impl(args: Args) -> Response {
    let (my_index, my_user_id, pin_enabled, local_user_index_canister_id) = read_state(|state| {
        state.with_caller_user(|my_index, user| {
            (
                my_index,
                state.user_id(my_index),
                user.pin_number.enabled(),
                state.data.local_user_index_canister_id,
            )
        })
    });

    // A user who has forgotten their PIN resets it by signing in again, which the LocalUserIndex
    // verifies for them, as it does for a user in a canister of their own
    let signed_in_again = match &args.verification {
        PinNumberVerification::Reauthenticated(sign_in_proof_jwt) if pin_enabled => {
            match local_user_index_canister_c2c_client::c2c_verify_sign_in_proof(
                local_user_index_canister_id,
                &local_user_index_canister::c2c_verify_sign_in_proof::Args {
                    sign_in_proof_jwt: sign_in_proof_jwt.clone(),
                    user_id: Some(my_user_id),
                },
            )
            .await
            {
                Ok(Response::Success) => true,
                Ok(error) => return error,
                Err(error) => return Response::Error(error.into()),
            }
        }
        _ => false,
    };

    mutate_state(|state| set_pin_number_impl_inner(args, my_index, signed_in_again, state))
}

fn set_pin_number_impl_inner(args: Args, my_index: u16, signed_in_again: bool, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    // The user is looked up again, since they may have been deleted while their sign in was verified
    let result = state.data.users.with_user_mut(my_index, |user| {
        if user.pin_number.enabled() {
            match args.verification {
                PinNumberVerification::None => return Err(Response::Error(OCErrorCode::PinRequired.into())),
                PinNumberVerification::PIN(mut attempt) => {
                    if let Err(error) = user.pin_number.verify(Some(&mut attempt), now) {
                        return Err(Response::Error(error.into()));
                    }
                }
                PinNumberVerification::Reauthenticated(_) if signed_in_again => {}
                // Can't happen, since the sign in is verified whenever the PIN was set, and nothing
                // is awaited otherwise, but fails closed rather than skip the check
                PinNumberVerification::Reauthenticated(_) => {
                    return Err(Response::Error(OCErrorCode::PinRequired.into()));
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
        Ok(())
    });

    match result {
        Some(Ok(())) => {
            state.award_achievement_and_notify(my_index, Achievement::SetPin, now);
            Response::Success
        }
        Some(Err(response)) => response,
        None => Response::Error(OCErrorCode::InitiatorNotFound.into()),
    }
}
