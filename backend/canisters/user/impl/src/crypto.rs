use crate::read_state;
use ledger_utils::{nns, sns};
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
    let (my_user_id, ledger_canister_id, now) = read_state(|state| {
        if check_caller && state.env.caller() != state.data.owner {
            panic!("Only the owner can transfer cryptocurrency");
        }

        let my_user_id: UserId = state.env.canister_id().into();
        let ledger_canister_id = state.data.ledger_canister_id(&transaction.token());
        let now = state.env.now_nanos();

        (my_user_id, ledger_canister_id, now)
    });

    match transaction {
        PendingCryptoTransaction::NNS(t) => nns::process_transaction(t, my_user_id.into(), ledger_canister_id, now).await,
        PendingCryptoTransaction::SNS(t) => sns::process_transaction(t, my_user_id.into(), ledger_canister_id, now).await,
    }
}
