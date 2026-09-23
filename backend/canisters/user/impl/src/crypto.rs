use crate::read_state;
use oc_error_codes::{OCError, OCErrorCode};
use types::{
    C2CError, CanisterId, CompletedCryptoTransaction, FailedCryptoTransaction, OCResult, PendingCryptoTransaction, UserId,
    UserIdAndPrincipal, icrc1,
};

pub use ledger_utils::{deposit_to_accept_p2p_swap, icrc2_transfer_from};

// The user's wallet. A user alone in their canister, or a bot, holds their funds in the account of
// their user id, which a bot's principal is too. A user in a MultiUser canister holds their own funds
// in their principal's account, which is looked up.
pub async fn user_wallet(user_id: UserId, local_user_index_canister_id: CanisterId) -> OCResult<UserIdAndPrincipal> {
    if !user_id.is_indexed() {
        return Ok(UserIdAndPrincipal::new(user_id, user_id.as_principal()));
    }
    match local_user_index_canister_c2c_client::lookup_user(user_id.as_principal(), local_user_index_canister_id).await? {
        // The lookup also resolves the principal a user signs in with, which isn't their user id
        Some(user) if user.user_id == user_id => Ok(UserIdAndPrincipal::new(user_id, user.principal)),
        _ => Err(OCErrorCode::TargetUserNotFound.into()),
    }
}

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
) -> Result<Result<CompletedCryptoTransaction, (FailedCryptoTransaction, OCError)>, C2CError> {
    process_transaction_internal(transaction, true).await
}

// `process_transaction` should be used whenever possible.
// Only call `process_transaction_without_caller_check` if an async operation has already been
// processed as part of the currently executing update call, since in that scenario we are within a
// reply callback and therefore are not able to access the original `caller`.
// If calling this method, ensure that the caller has been validated earlier on.
pub async fn process_transaction_without_caller_check(
    transaction: PendingCryptoTransaction,
) -> Result<Result<CompletedCryptoTransaction, (FailedCryptoTransaction, OCError)>, C2CError> {
    process_transaction_internal(transaction, false).await
}

async fn process_transaction_internal(
    transaction: PendingCryptoTransaction,
    check_caller: bool,
) -> Result<Result<CompletedCryptoTransaction, (FailedCryptoTransaction, OCError)>, C2CError> {
    let me = read_state(|state| {
        if check_caller && state.env.caller() != state.data.user.principal {
            panic!("Only the owner can transfer cryptocurrency");
        }

        UserIdAndPrincipal::new(state.env.canister_id().into(), state.data.user.principal)
    });

    ledger_utils::process_transaction(transaction, Some(me), false).await
}

// The user's own account is the canister's default account, so any account the canister holds is
// theirs
pub(crate) fn validate_from_account(from_account: Option<icrc1::Account>, my_user_id: UserId) -> OCResult {
    ledger_utils::validate_from_account(from_account, my_user_id.canister_id())
}
