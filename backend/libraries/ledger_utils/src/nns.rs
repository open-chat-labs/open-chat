use crate::{calculate_transaction_hash, default_ledger_account};
use ic_ledger_types::{Memo, Timestamp, TransferArgs, DEFAULT_FEE};
use types::{CanisterId, CompletedCryptoTransaction, FailedCryptoTransaction, TimestampNanos};

pub async fn process_transaction(
    transaction: types::nns::PendingCryptoTransaction,
    sender: CanisterId,
    ledger_canister_id: CanisterId,
    now_nanos: TimestampNanos,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    let memo = transaction.memo.unwrap_or(Memo(0));
    let fee = transaction.fee.unwrap_or(DEFAULT_FEE);

    let from = default_ledger_account(sender);
    let to = match transaction.to {
        types::nns::UserOrAccount::User(u) => default_ledger_account(u.into()),
        types::nns::UserOrAccount::Account(a) => a,
    };

    let transfer_args = TransferArgs {
        memo,
        amount: transaction.amount,
        fee,
        from_subaccount: None,
        to,
        created_at_time: Some(Timestamp {
            timestamp_nanos: now_nanos,
        }),
    };

    let transaction_hash = calculate_transaction_hash(sender, &transfer_args);

    match ic_ledger_types::transfer(ledger_canister_id, transfer_args).await {
        Ok(Ok(block_index)) => Ok(CompletedCryptoTransaction::NNS(types::nns::CompletedCryptoTransaction {
            token: transaction.token,
            amount: transaction.amount,
            fee,
            from: types::nns::CryptoAccount::Account(from),
            to: types::nns::CryptoAccount::Account(to),
            memo,
            created: now_nanos,
            transaction_hash,
            block_index,
        })),
        Ok(Err(transfer_error)) => {
            let error_message = format!("Transfer failed. {transfer_error:?}");
            Err(error_message)
        }
        Err((code, msg)) => {
            let error_message = format!("Transfer failed. {code:?}: {msg}");
            Err(error_message)
        }
    }
    .map_err(|error| {
        FailedCryptoTransaction::NNS(types::nns::FailedCryptoTransaction {
            token: transaction.token,
            amount: transaction.amount,
            fee,
            from: types::nns::CryptoAccount::Account(from),
            to: types::nns::CryptoAccount::Account(to),
            memo,
            created: now_nanos,
            transaction_hash,
            error_message: error,
        })
    })
}
