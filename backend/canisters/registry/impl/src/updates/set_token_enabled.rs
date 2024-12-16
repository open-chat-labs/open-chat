use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use registry_canister::set_token_enabled::{Response::*, *};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update(msgpack = true)]
#[trace]
async fn set_token_enabled(args: Args) -> Response {
    let (caller, user_index_canister_id, escrow_canister_id) = read_state(|state| {
        (
            state.env.caller(),
            state.data.user_index_canister_id,
            state.data.escrow_canister_id,
        )
    });

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => {}
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    }

    if let Err(error) = escrow_canister_c2c_client::c2c_set_token_enabled(
        escrow_canister_id,
        &escrow_canister::c2c_set_token_enabled::Args {
            ledger_canister_id: args.ledger_canister_id,
            enabled: args.enabled,
        },
    )
    .await
    {
        return InternalError(format!("Failed to update Escrow canister: {error:?}"));
    }

    mutate_state(|state| {
        state
            .data
            .tokens
            .set_enabled(args.ledger_canister_id, args.enabled, state.env.now())
    });
    Success
}
