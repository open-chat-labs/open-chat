use crate::timer_job_types::ForwardSolDepositJob;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use cksol_minter_canister::MINIMUM_DEPOSIT_AMOUNT;
use multi_user_canister::update_sol_balance::*;
use oc_error_codes::{OCError, OCErrorCode};
use tracing::error;
use types::icrc1;
use user_core::updates::update_sol_balance::{sol_balance_from_alchemy, sol_deposit_account, update_sol_balance as update};

// Only the user, or the LocalUserIndex for them, may ask for their balance to be updated, since the
// canister pays the ckSOL minter for each request. For the same reason, once a platform operator has
// set the Alchemy API key, the balance is checked through Alchemy first, for far less.
#[update(msgpack = true)]
#[trace]
async fn update_sol_balance(args: Args) -> Response {
    execute_update_async(|| update_sol_balance_impl(args)).await
}

async fn update_sol_balance_impl(args: Args) -> Response {
    let PrepareResult {
        user_index,
        principal,
        deposit_account,
        alchemy_api_key,
        sol_address,
    } = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    // Without an address the user can't have deposited anything. Every address is generated through
    // `generate_sol_address`, which caches it.
    let Some(sol_address) = sol_address else {
        return Response::Error(OCErrorCode::NoChange.into());
    };

    if let Some(api_key) = alchemy_api_key {
        match sol_balance_from_alchemy(&api_key, &sol_address).await {
            Ok(balance) if balance < MINIMUM_DEPOSIT_AMOUNT => return Response::Error(OCErrorCode::NoChange.into()),
            Ok(_) => {}
            // Rather than falling back to asking the minter, so that Alchemy limiting the rate of
            // requests can't leave the canister paying the minter for each of them. The website checks
            // the balance through Alchemy too, so wouldn't be asking.
            Err(error) => {
                error!(%error, "Failed to check SOL balance through Alchemy");
                return Response::Error(OCErrorCode::Unknown.with_message("Failed to check SOL balance"));
            }
        }
    }

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

struct PrepareResult {
    user_index: u16,
    principal: Principal,
    deposit_account: icrc1::Account,
    alchemy_api_key: Option<String>,
    sol_address: Option<String>,
}

fn prepare(args: Args, state: &RuntimeState) -> Result<PrepareResult, OCError> {
    let user_index = state.authorized_user_index(args.user_id)?;
    let (principal, sol_address) = state
        .data
        .users
        .with_user(user_index, |user| {
            (user.principal, user.sol_address.as_ref().map(|a| a.value.clone()))
        })
        .ok_or(OCErrorCode::TargetUserNotFound)?;

    Ok(PrepareResult {
        user_index,
        principal,
        deposit_account: sol_deposit_account(state.env.canister_id(), principal),
        alchemy_api_key: state.data.alchemy_api_key.clone(),
        sol_address,
    })
}
