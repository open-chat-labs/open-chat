use crate::{RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MINUTE_IN_MS;
use identity_canister::delete_user::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, UserId};

#[update(msgpack = true, candid = true)]
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
    state
        .data
        .verify_certificate_time(&auth_principal, &args.delegation.signature, now, 5 * MINUTE_IN_MS)?;

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
