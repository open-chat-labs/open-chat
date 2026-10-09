use candid::Principal;
use oc_error_codes::{OCError, OCErrorCode};
use types::{CanisterId, OCResult, UserId, icrc1};

// Users hold their own funds in their principal's account, which this canister can't spend from or
// approve transfers from. So the endpoints which would spend a user's funds for them reject the
// request until users can make those payments themselves.
pub fn user_funds_not_spendable() -> OCError {
    OCErrorCode::InvalidRequest
        .with_message("Not supported by the MultiUser canister, since users hold their own funds in their own wallets")
}

// The wallet of a user in another canister, as in the User canister. A user alone in their canister,
// or a bot, holds their funds in the account of their user id. A user in a MultiUser canister holds
// their own funds in their principal's account, which is looked up.
pub async fn user_wallet(user_id: UserId, local_user_index_canister_id: CanisterId) -> OCResult<icrc1::Account> {
    if !user_id.is_indexed() {
        return Ok(user_id.as_principal().into());
    }
    match local_user_index_canister_c2c_client::lookup_user(user_id.as_principal(), local_user_index_canister_id).await? {
        // The lookup also resolves the principal a user signs in with, which isn't their user id
        Some(user) if user.user_id == user_id => Ok(user.principal.into()),
        _ => Err(OCErrorCode::TargetUserNotFound.into()),
    }
}

// The subaccount of this canister which holds the output (or a refund) of a user's token swap between
// it being withdrawn from the DEX and sent on to their wallet. It is derived from the principal the
// user signs in with, as their spender subaccount is, so each user's swaps are kept apart from others'.
pub fn swap_subaccount(principal: Principal) -> [u8; 32] {
    ledger_utils::spender_subaccount(principal)
}
