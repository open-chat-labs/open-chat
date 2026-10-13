use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, UserId, icrc1};

// The wallet of a user in another canister. A bot's wallet is the account of its user id, as is that
// of an old id, which was a User canister's id. A user holds their own funds in their principal's
// account, which is looked up.
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
