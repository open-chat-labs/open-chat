use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use constants::{MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use ic_cdk::update;
use ic_certificate_verification::VerifyCertificate;
use identity_canister::delete_user::{Response::*, *};
use identity_canister::WEBAUTHN_ORIGINATING_CANISTER;
use identity_utils::extract_certificate;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, UserId};

#[update]
#[trace]
async fn delete_user(args: Args) -> Response {
    let PrepareResult {
        user_index_canister_id,
        principal,
        user_id,
    } = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    match user_index_canister_c2c_client::c2c_delete_user(
        user_index_canister_id,
        &user_index_canister::c2c_delete_user::Args { user_id },
    )
    .await
    {
        Ok(user_index_canister::c2c_delete_user::Response::Success) => {
            mutate_state(|state| state.data.user_principals.set_user_id(principal, None));
            Success
        }
        Ok(user_index_canister::c2c_delete_user::Response::Error(error)) => Error(error),
        Err(error) => Error(error.into()),
    }
}

struct PrepareResult {
    user_index_canister_id: CanisterId,
    principal: Principal,
    user_id: UserId,
}

fn prepare(args: Args, state: &RuntimeState) -> OCResult<PrepareResult> {
    let caller = state.env.caller();
    let Some(auth_principal) = state.data.user_principals.get_auth_principal(&caller) else {
        return Err(OCErrorCode::InitiatorNotFound.into());
    };

    let now = state.env.now();
    if auth_principal.originating_canister != WEBAUTHN_ORIGINATING_CANISTER {
        let certificate = match extract_certificate(&args.delegation.signature) {
            Ok(c) => c,
            Err(e) => return Err(OCErrorCode::MalformedSignature.with_message(e)),
        };
        if certificate
            .verify(
                auth_principal.originating_canister.as_slice(),
                state.data.ic_root_key.as_slice(),
            )
            .is_err()
        {
            return Err(OCErrorCode::InvalidSignature.into());
        }

        let now_nanos = (now * NANOS_PER_MILLISECOND) as u128;
        let five_minutes = (5 * MINUTE_IN_MS * NANOS_PER_MILLISECOND) as u128;

        if ic_certificate_verification::validate_certificate_time(&certificate, &now_nanos, &five_minutes).is_err() {
            return Err(OCErrorCode::DelegationTooOld.into());
        }
    }

    if let Some(user_id) = state
        .data
        .user_principals
        .get_by_auth_principal(&caller)
        .and_then(|u| u.user_id)
    {
        Ok(PrepareResult {
            user_index_canister_id: state.data.user_index_canister_id,
            principal: caller,
            user_id,
        })
    } else {
        Err(OCErrorCode::InitiatorNotFound.with_message("UserId not found"))
    }
}
