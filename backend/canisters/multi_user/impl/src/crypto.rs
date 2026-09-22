use oc_error_codes::OCError;
use types::{C2CError, CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction, UserId};

pub use ledger_utils::validate_from_account;

// Makes the transfer from the account of the user at `my_user_id`, one of this canister's
// subaccounts. The caller has already checked the caller may act as that user.
pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
    my_user_id: UserId,
) -> Result<Result<CompletedCryptoTransaction, (FailedCryptoTransaction, OCError)>, C2CError> {
    ledger_utils::process_transaction(transaction, Some(my_user_id), false).await
}
