use crate::guards::caller_is_local_user_or_multi_user_canister;
use crate::updates::c2c_user_canister_v2::is_valid_user_for_caller;
use crate::{RuntimeState, read_state};
use candid::Principal;
use canister_api_macros::update;
use local_user_index_canister::c2c_verify_sign_in_proof::*;
use oc_error_codes::OCErrorCode;
use types::{CLAIM_TYPE_USER_SIGNED_IN, TimestampMillis, UserId, UserSignedInClaims};

// Checks a user has just signed in again, for a User canister or for a MultiUser canister acting for
// one of the users it hosts
#[update(guard = "caller_is_local_user_or_multi_user_canister", msgpack = true)]
fn c2c_verify_sign_in_proof(args: Args) -> Response {
    read_state(|state| c2c_verify_sign_in_proof_impl(args, state))
}

fn c2c_verify_sign_in_proof_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let user_id = args.user_id.unwrap_or_else(|| UserId::from(caller));
    if !is_valid_user_for_caller(user_id, caller, state.is_caller_local_multi_user_canister()) {
        return Response::Error(OCErrorCode::InitiatorNotAuthorized.into());
    }
    let Some(user) = state.data.global_users.get_by_user_id(&user_id) else {
        return Response::Error(OCErrorCode::InitiatorNotFound.into());
    };

    if verify_sign_in_proof(
        &args.sign_in_proof_jwt,
        user.principal,
        state.data.oc_key_pair.public_key_pem(),
        state.env.now(),
    ) {
        Response::Success
    } else {
        Response::Error(OCErrorCode::InvalidSignature.into())
    }
}

pub(crate) fn verify_sign_in_proof(jwt: &str, user_principal: Principal, public_key_pem: &str, now: TimestampMillis) -> bool {
    jwt::verify_and_decode::<UserSignedInClaims>(jwt, public_key_pem, CLAIM_TYPE_USER_SIGNED_IN)
        .is_ok_and(|claims| claims.exp_ms() > now && claims.custom().principal == user_principal)
}
