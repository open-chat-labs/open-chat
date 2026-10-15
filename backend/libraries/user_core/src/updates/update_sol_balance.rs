use cksol_minter_canister::deposit_sol::{DepositSolError, InsufficientCyclesError};
use cksol_minter_canister::{CKSOL_MINTER_CANISTER_ID, DEPOSIT_SOL_REQUIRED_CYCLES, MAX_DEPOSIT_SOL_CYCLES};
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::{OCResult, UserIdAndPrincipal, icrc1};

// Asks the ckSOL minter to sweep the SOL deposited to the user's address into its own account, then
// mint that much ckSOL, less the deposit's share of the sweep's fee, to the user's wallet. It mints
// once the sweep is finalized, after this returns. A deposit already in flight is left as it is.
pub async fn update_sol_balance(me: UserIdAndPrincipal) -> OCResult {
    let wallet = icrc1::Account::from(me);
    let args = cksol_minter_canister::deposit_sol::Args {
        owner: Some(wallet.owner),
        subaccount: wallet.subaccount,
    };

    let mut response =
        cksol_minter_canister_c2c_client::deposit_sol(CKSOL_MINTER_CANISTER_ID, &args, DEPOSIT_SOL_REQUIRED_CYCLES).await?;

    // The minter may since have been upgraded to require more cycles. It refunds what it doesn't
    // charge, so attach what it now asks for, within reason.
    if let Err(DepositSolError::InsufficientCycles(InsufficientCyclesError { expected, .. })) = &response
        && let Ok(cycles) = u128::try_from(&expected.0)
        && cycles <= MAX_DEPOSIT_SOL_CYCLES
    {
        response = cksol_minter_canister_c2c_client::deposit_sol(CKSOL_MINTER_CANISTER_ID, &args, cycles).await?;
    }

    match response {
        Ok(_) => Ok(()),
        Err(DepositSolError::ValueTooSmall { .. } | DepositSolError::AlreadyProcessing) => Err(OCErrorCode::NoChange.into()),
        Err(error) => {
            error!(?error, "Failed to update SOL balance");
            Err(OCErrorCode::Unknown.with_json(&error))
        }
    }
}
