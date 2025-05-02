use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MINUTE_IN_MS;
use identity_canister::initiate_identity_link_via_qr_code::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn initiate_identity_link_via_qr_code(args: Args) -> Response {
    mutate_state(|state| initiate_identity_link_via_qr_code_impl(args, state)).into()
}

fn initiate_identity_link_via_qr_code_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let caller = state.env.caller();
    let auth_principal = state
        .data
        .user_principals
        .get_auth_principal(&caller)
        .ok_or(OCErrorCode::InitiatorNotFound)?;

    let now = state.env.now();
    state
        .data
        .verify_certificate_time(&auth_principal, &args.delegation.signature, now, 5 * MINUTE_IN_MS)?;

    state
        .data
        .identity_link_via_qr_code_requests
        .push(args.link_code, auth_principal.user_principal_index, now);

    Ok(())
}
