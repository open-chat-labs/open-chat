use ckbtc_minter_canister::CKBTC_MINTER_CANISTER_ID;
use types::{C2CError, UserIdAndPrincipal, icrc1};

// Asks the ckBTC minter for the BTC address which deposits to the user's wallet. The caller serves
// the cached address if there is one, and caches this.
pub async fn fetch_btc_address(me: UserIdAndPrincipal) -> Result<String, C2CError> {
    let wallet = icrc1::Account::from(me);
    ckbtc_minter_canister_c2c_client::get_btc_address(
        CKBTC_MINTER_CANISTER_ID,
        &ckbtc_minter_canister::get_btc_address::Args {
            owner: Some(wallet.owner),
            subaccount: wallet.subaccount,
        },
    )
    .await
}
