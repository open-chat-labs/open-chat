use ic_ledger_canister_core::ledger::LedgerTransaction;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{Memo, TransferArg};
use types::{CanisterId, CompletedCryptoTransaction, FailedCryptoTransaction, TransactionHash};

pub async fn process_transaction(
    transaction: types::sns::PendingCryptoTransaction,
    sender: CanisterId,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    let from = Account::from(sender);

    let args = TransferArg {
        from_subaccount: None,
        to: transaction.to,
        fee: Some(transaction.fee.e8s().into()),
        created_at_time: Some(transaction.created),
        memo: transaction.memo.map(|m| Memo::from(m.0)),
        amount: transaction.amount.e8s().into(),
    };

    let transaction_hash = transaction_hash(from, &args);

    let client = ic_icrc1_client::ICRC1Client {
        ledger_canister_id: transaction.ledger,
        runtime: ic_icrc1_client_cdk::CdkRuntime,
    };

    match client.transfer(args).await {
        Ok(Ok(block_index)) => Ok(CompletedCryptoTransaction::SNS(types::sns::CompletedCryptoTransaction {
            // ledger: transaction.ledger,
            token: transaction.token,
            amount: transaction.amount,
            fee: transaction.fee,
            from: types::sns::CryptoAccount::Account(from),
            to: types::sns::CryptoAccount::Account(transaction.to),
            memo: transaction.memo,
            created: transaction.created,
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
        FailedCryptoTransaction::SNS(types::sns::FailedCryptoTransaction {
            // ledger: transaction.ledger,
            token: transaction.token,
            amount: transaction.amount,
            fee: transaction.fee,
            from: types::sns::CryptoAccount::Account(from),
            to: types::sns::CryptoAccount::Account(transaction.to),
            memo: transaction.memo,
            created: transaction.created,
            transaction_hash,
            error_message: error,
        })
    })
}

pub fn transaction_hash(from: Account, args: &TransferArg) -> TransactionHash {
    ic_icrc1::Transaction {
        operation: ic_icrc1::Operation::Transfer {
            from,
            to: args.to,
            amount: args.amount.clone().0.try_into().unwrap(),
            fee: args.fee.clone().and_then(|f| f.0.try_into().ok()),
        },
        created_at_time: args.created_at_time,
        memo: args.memo.clone(),
    }
    .hash()
    .into_bytes()
}
