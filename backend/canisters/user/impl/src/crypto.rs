use crate::read_state;
use types::{CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction, UserId};

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    process_transaction_internal(transaction, true).await
}

// `process_transaction` should be used whenever possible.
// Only call `process_transaction_without_caller_check` if an async operation has already been
// processed as part of the currently executing update call, since in that scenario we are within a
// reply callback and therefore are not able to access the original `caller`.
// If calling this method, ensure that the caller has been validated earlier on.
pub async fn process_transaction_without_caller_check(
    transaction: PendingCryptoTransaction,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    process_transaction_internal(transaction, false).await
}

async fn process_transaction_internal(
    transaction: PendingCryptoTransaction,
    check_caller: bool,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    let my_user_id = read_state(|state| {
        if check_caller && state.env.caller() != state.data.owner {
            panic!("Only the owner can transfer cryptocurrency");
        }

        UserId::from(state.env.canister_id())
    });

    ledger_utils::process_transaction(transaction, my_user_id.into()).await
}
