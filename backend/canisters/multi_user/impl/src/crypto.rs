use crate::verify_not_old_user_id;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, UserId, icrc1};

// The wallet of a user in another canister. A user holds their own funds in their principal's
// account, which is looked up. A bot's wallet is the account of its user id. A User canister's id,
// which users had before being migrated to MultiUser canisters, isn't paid (see
// `verify_not_old_user_id`).
pub async fn user_wallet(user_id: UserId, local_user_index_canister_id: CanisterId) -> OCResult<icrc1::Account> {
    if !user_id.is_indexed() {
        return bot_wallet(user_id);
    }
    match local_user_index_canister_c2c_client::lookup_user(user_id.as_principal(), local_user_index_canister_id).await? {
        // The lookup also resolves the principal a user signs in with, which isn't their user id
        Some(user) if user.user_id == user_id => Ok(user.principal.into()),
        _ => Err(OCErrorCode::TargetUserNotFound.into()),
    }
}

fn bot_wallet(user_id: UserId) -> OCResult<icrc1::Account> {
    verify_not_old_user_id(user_id)?;
    Ok(user_id.as_principal().into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn a_bot_is_paid_at_its_user_id_but_an_old_user_canister_id_is_refused() {
        let bot_id = UserId::from(Principal::from_slice(&[1, 2, 3, 4, 5, 6, 7, 8]));
        assert_eq!(bot_wallet(bot_id).unwrap().owner, bot_id.as_principal());

        let old_user_id = UserId::from(Principal::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap());
        assert!(
            bot_wallet(old_user_id)
                .unwrap_err()
                .matches_code(OCErrorCode::TargetUserNotFound)
        );
    }
}
