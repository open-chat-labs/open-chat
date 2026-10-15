use cksol_minter_canister::deposit_sol::DepositSolError;
use cksol_minter_canister::{CKSOL_MINTER_CANISTER_ID, DEPOSIT_SOL_REQUIRED_CYCLES};
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::{OCResult, UserIdAndPrincipal, icrc1};

// Asks the ckSOL minter to sweep the SOL deposited to the user's address into its own account, then
// mint that much ckSOL, less the deposit's share of the sweep's fee, to the user's wallet. It mints
// once the sweep is finalized, after this returns. A deposit already in flight is left as it is.
pub async fn update_sol_balance(me: UserIdAndPrincipal) -> OCResult {
    let wallet = icrc1::Account::from(me);

    match cksol_minter_canister_c2c_client::deposit_sol(
        CKSOL_MINTER_CANISTER_ID,
        &cksol_minter_canister::deposit_sol::Args {
            owner: Some(wallet.owner),
            subaccount: wallet.subaccount,
        },
        DEPOSIT_SOL_REQUIRED_CYCLES,
    )
    .await?
    {
        Ok(_) => Ok(()),
        Err(DepositSolError::ValueTooSmall { .. } | DepositSolError::AlreadyProcessing) => Err(OCErrorCode::NoChange.into()),
        Err(error) => {
            error!(?error, "Failed to update SOL balance");
            Err(OCErrorCode::Unknown.with_json(&error))
        }
    }
}
