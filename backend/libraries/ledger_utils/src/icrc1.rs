use types::icrc1::{Account, TransferArg};
use types::{CanisterId, CompletedCryptoTransaction, FailedCryptoTransaction};

pub async fn process_transaction(
    transaction: types::icrc1::PendingCryptoTransaction,
    sender: CanisterId,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    let from = Account::from(sender);

    let args = TransferArg {
        from_subaccount: None,
        to: transaction.to,
        fee: Some(transaction.fee.into()),
        created_at_time: Some(transaction.created),
        memo: transaction.memo.clone(),
        amount: transaction.amount.into(),
    };

    match icrc1_ledger_canister_c2c_client::icrc1_transfer(transaction.ledger, &args).await {
        Ok(Ok(block_index)) => Ok(CompletedCryptoTransaction::ICRC1(types::icrc1::CompletedCryptoTransaction {
            // ledger: transaction.ledger,
            token: transaction.token,
            amount: transaction.amount,
            fee: transaction.fee,
            from: types::icrc1::CryptoAccount::Account(from),
            to: types::icrc1::CryptoAccount::Account(transaction.to),
            memo: transaction.memo.clone(),
            created: transaction.created,
            block_index: block_index.0.try_into().unwrap(),
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
        FailedCryptoTransaction::ICRC1(types::icrc1::FailedCryptoTransaction {
            // ledger: transaction.ledger,
            token: transaction.token,
            amount: transaction.amount,
            fee: transaction.fee,
            from: types::icrc1::CryptoAccount::Account(from),
            to: types::icrc1::CryptoAccount::Account(transaction.to),
            memo: transaction.memo,
            created: transaction.created,
            error_message: error,
        })
    })
}
