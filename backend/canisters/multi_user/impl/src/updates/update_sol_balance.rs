use crate::{execute_update_async, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::update_sol_balance::*;
use oc_error_codes::{OCError, OCErrorCode};
use types::UserIdAndPrincipal;

// Only the user, or the LocalUserIndex for them, may ask for their balance to be updated, since the
// canister pays the ckSOL minter for each request
#[update(msgpack = true)]
#[trace]
async fn update_sol_balance(args: Args) -> Response {
    execute_update_async(|| update_sol_balance_impl(args)).await
}

async fn update_sol_balance_impl(args: Args) -> Response {
    let me = match read_state(|state| {
        let index = state.authorized_user_index(args.user_id)?;
        let principal = state
            .data
            .users
            .with_user(index, |user| user.principal)
            .ok_or(OCErrorCode::TargetUserNotFound)?;
        Ok::<_, OCError>(UserIdAndPrincipal::new(args.user_id, principal))
    }) {
        Ok(me) => me,
        Err(error) => return Response::Error(error),
    };

    match user_core::updates::update_sol_balance::update_sol_balance(me).await {
        Ok(()) => Response::Success,
        Err(error) => Response::Error(error),
    }
}
