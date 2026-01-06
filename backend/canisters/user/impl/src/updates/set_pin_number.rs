use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{Achievement, FieldTooLongResult, FieldTooShortResult};
use user_canister::set_pin_number::*;

const MIN_LENGTH: usize = 4;
const MAX_LENGTH: usize = 20;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn set_pin_number(args: Args) -> Response {
    execute_update_async(|| set_pin_number_impl(args)).await
}

async fn set_pin_number_impl(args: Args) -> Response {
    if read_state(|state| state.data.pin_number.enabled()) {
        match args.verification {
            PinNumberVerification::None => return Response::Error(OCErrorCode::PinRequired.into()),
            PinNumberVerification::PIN(attempt) => {
                if let Err(error) = mutate_state(|state| state.data.pin_number.verify(Some(&attempt), state.env.now())) {
                    return Response::Error(error.into());
                }
            }
            PinNumberVerification::Delegation(_) => {}
            PinNumberVerification::Reauthenticated(sign_in_proof_jwt) => {
                let local_user_index_canister_id = read_state(|state| state.data.local_user_index_canister_id);
                match local_user_index_canister_c2c_client::c2c_verify_sign_in_proof(
                    local_user_index_canister_id,
                    &local_user_index_canister::c2c_verify_sign_in_proof::Args { sign_in_proof_jwt },
                )
                .await
                {
                    Ok(Response::Success) => {}
                    Ok(error) => return error,
                    Err(error) => return Response::Error(error.into()),
                }
            }
        }
    }

    if let Some(new) = args.new.as_ref() {
        let length = new.len();
        if length < MIN_LENGTH {
            return Response::Error(OCErrorCode::PinTooShort.with_json(&FieldTooShortResult {
                length_provided: length as u32,
                min_length: MIN_LENGTH as u32,
            }));
        }
        if length > MAX_LENGTH {
            return Response::Error(OCErrorCode::PinTooLong.with_json(&FieldTooLongResult {
                length_provided: length as u32,
                max_length: MAX_LENGTH as u32,
            }));
        }
    }

    mutate_state(|state| {
        let now = state.env.now();
        state.data.pin_number.set(args.new.map(|p| p.into()), now);
        state.award_achievement_and_notify(Achievement::SetPin, now);
    });
    Response::Success
}
