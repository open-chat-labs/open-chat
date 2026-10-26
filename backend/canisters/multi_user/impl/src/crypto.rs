use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, UserId, icrc1};

// The wallet of a user in another canister: the account of their principal, which is looked up.
// Only users have one (see `verify_is_user`).
pub async fn user_wallet(user_id: UserId, local_user_index_canister_id: CanisterId) -> OCResult<icrc1::Account> {
    verify_is_user(user_id)?;
    match local_user_index_canister_c2c_client::lookup_user(user_id.as_principal(), local_user_index_canister_id).await? {
        // The lookup also resolves the principal a user signs in with, which isn't their user id
        Some(user) if user.user_id == user_id => Ok(user.principal.into()),
        _ => Err(OCErrorCode::TargetUserNotFound.into()),
    }
}

// Only users hold funds, and only a user's id carries an index. A bot's id isn't an account anyone
// controls, so anything paid to it would be lost, and a User canister's id, which users had before
// being migrated to MultiUser canisters, names nobody.
fn verify_is_user(user_id: UserId) -> OCResult {
    if user_id.is_indexed() {
        Ok(())
    } else {
        Err(OCErrorCode::InvalidRequest.with_message("Only users can be paid"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn neither_a_bot_nor_an_old_user_canister_id_is_paid() {
        let bot_id = UserId::from(Principal::from_slice(&[1, 2, 3, 4, 5, 6, 7, 8]));
        assert!(verify_is_user(bot_id).unwrap_err().matches_code(OCErrorCode::InvalidRequest));

        let old_user_id = UserId::from(Principal::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap());
        assert!(
            verify_is_user(old_user_id)
                .unwrap_err()
                .matches_code(OCErrorCode::InvalidRequest)
        );

        let user_id = UserId::new_indexed(Principal::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap(), 1);
        assert!(verify_is_user(user_id).is_ok());
    }
}
