use crate::timer_job_types::ForwardSolDepositJob;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::update_sol_balance::*;
use oc_error_codes::{OCError, OCErrorCode};
use user_core::updates::update_sol_balance::{sol_deposit_account, update_sol_balance as update};

// Only the user, or the LocalUserIndex for them, may ask for their balance to be updated, since the
// canister pays the ckSOL minter for each request
#[update(msgpack = true)]
#[trace]
async fn update_sol_balance(args: Args) -> Response {
    execute_update_async(|| update_sol_balance_impl(args)).await
}

async fn update_sol_balance_impl(args: Args) -> Response {
    let (user_index, principal, deposit_account) = match read_state(|state| {
        let index = state.authorized_user_index(args.user_id)?;
        let principal = state
            .data
            .users
            .with_user(index, |user| user.principal)
            .ok_or(OCErrorCode::TargetUserNotFound)?;
        Ok::<_, OCError>((index, principal, sol_deposit_account(state.env.canister_id(), principal)))
    }) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    match update(deposit_account).await {
        Ok(deposit_id) => {
            // The minter mints the deposit to the user's deposit account once it is swept, from where
            // the job forwards it to their wallet
            mutate_state(|state| ForwardSolDepositJob::start(user_index, principal, deposit_id, state));
            Response::Success
        }
        Err(error) => Response::Error(error),
    }
}
