use oc_error_codes::OCError;
use types::{C2CError, CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction, UserIdAndPrincipal};

pub use ledger_utils::validate_from_account;

// Makes the transfer on behalf of `me`. The caller has already checked the caller may act as that
// user. Their funds are in their principal's account rather than this canister's, so this fails
// until the canister accepts transfers the user has made themselves.
pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
    me: UserIdAndPrincipal,
) -> Result<Result<CompletedCryptoTransaction, (FailedCryptoTransaction, OCError)>, C2CError> {
    ledger_utils::process_transaction(transaction, Some(me), false).await
}
