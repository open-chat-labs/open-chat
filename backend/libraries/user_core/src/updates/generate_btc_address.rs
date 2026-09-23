use ckbtc_minter_canister::CKBTC_MINTER_CANISTER_ID;
use types::{C2CError, UserId, icrc1};

// Asks the ckBTC minter for the BTC address which deposits to the user's account. The caller
// serves the cached address if there is one, and caches this.
pub async fn fetch_btc_address(my_user_id: UserId) -> Result<String, C2CError> {
    ckbtc_minter_canister_c2c_client::get_btc_address(
        CKBTC_MINTER_CANISTER_ID,
        &ckbtc_minter_canister::get_btc_address::Args {
            owner: None,
            subaccount: icrc1::Account::legacy_for_user(my_user_id).subaccount,
        },
    )
    .await
}
