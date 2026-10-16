use cksol_minter_canister::CKSOL_MINTER_CANISTER_ID;
use types::{C2CError, icrc1};

// Asks the ckSOL minter for the Solana address which deposits to the user's deposit account (see
// `update_sol_balance::sol_deposit_account`). The caller serves the cached address if there is one,
// and caches this.
pub async fn fetch_sol_address(deposit_account: icrc1::Account) -> Result<String, C2CError> {
    cksol_minter_canister_c2c_client::get_deposit_address(
        CKSOL_MINTER_CANISTER_ID,
        &cksol_minter_canister::get_deposit_address::Args {
            owner: Some(deposit_account.owner),
            subaccount: deposit_account.subaccount,
        },
    )
    .await
}
