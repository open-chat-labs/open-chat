use constants::ONE_SEC_MINTER_CANISTER_ID;
use oc_error_codes::OCErrorCode;
use types::{OCResult, UserIdAndPrincipal, icrc1};

// Asks the OneSec minter for the address which forwards to the user's wallet. The caller serves
// the cached address if there is one, and caches this.
pub async fn fetch_one_sec_address(me: UserIdAndPrincipal) -> OCResult<String> {
    match one_sec_minter_canister_c2c_client::get_forwarding_address(
        ONE_SEC_MINTER_CANISTER_ID,
        &one_sec_minter_canister::IcpAccount::ICRC(icrc1::Account::from(me).into()),
    )
    .await?
    {
        Ok(address) => Ok(address),
        Err(error) => Err(OCErrorCode::Unknown.with_message(error)),
    }
}
