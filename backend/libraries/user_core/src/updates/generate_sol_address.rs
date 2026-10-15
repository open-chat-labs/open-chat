use cksol_minter_canister::CKSOL_MINTER_CANISTER_ID;
use types::{C2CError, UserIdAndPrincipal, icrc1};

// Asks the ckSOL minter for the Solana address which deposits to the user's wallet. The caller
// serves the cached address if there is one, and caches this.
pub async fn fetch_sol_address(me: UserIdAndPrincipal) -> Result<String, C2CError> {
    let wallet = icrc1::Account::from(me);
    cksol_minter_canister_c2c_client::get_deposit_address(
        CKSOL_MINTER_CANISTER_ID,
        &cksol_minter_canister::get_deposit_address::Args {
            owner: Some(wallet.owner),
            subaccount: wallet.subaccount,
        },
    )
    .await
}
