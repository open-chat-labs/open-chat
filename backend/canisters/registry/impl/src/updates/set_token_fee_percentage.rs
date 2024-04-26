use crate::{mutate_state, read_state};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use registry_canister::set_token_fee_percentage::{Response::*, *};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn set_token_fee_percentage(args: Args) -> Response {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => {}
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    }

    mutate_state(|state| {
        state
            .data
            .tokens
            .set_fee_percentage(args.ledger_canister_id, args.fee_percentage_basis_points, state.env.now())
    });
    Success
}
