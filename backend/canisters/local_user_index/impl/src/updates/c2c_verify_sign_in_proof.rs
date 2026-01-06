use crate::guards::caller_is_local_user_canister;
use crate::read_state;
use candid::Principal;
use canister_api_macros::update;
use local_user_index_canister::c2c_verify_sign_in_proof::*;
use oc_error_codes::OCErrorCode;
use types::{TimestampMillis, UserSignedInClaims};

#[update(guard = "caller_is_local_user_canister", msgpack = true)]
fn c2c_verify_sign_in_proof(args: Args) -> Response {
    if read_state(|state| {
        verify_sign_in_proof(
            &args.sign_in_proof_jwt,
            state.calling_user().principal,
            state.data.oc_key_pair.public_key_pem(),
            state.env.now(),
        )
    }) {
        Response::Success
    } else {
        Response::Error(OCErrorCode::InvalidSignature.into())
    }
}

pub(crate) fn verify_sign_in_proof(jwt: &str, user_principal: Principal, public_key_pem: &str, now: TimestampMillis) -> bool {
    jwt::verify_and_decode::<UserSignedInClaims>(&jwt, public_key_pem)
        .is_ok_and(|claims| claims.exp_ms() > now && claims.custom().principal == user_principal)
}
