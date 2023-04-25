use ic_ledger_canister_core::ledger::LedgerTransaction;
use types::{CanisterId, CompletedCryptoTransaction, FailedCryptoTransaction};

pub async fn process_transaction(
    transaction: types::sns::PendingCryptoTransaction,
    sender: CanisterId,
    ledger_canister_id: CanisterId,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    let my_principal = ic_base_types::PrincipalId::from(sender);
    let from = ic_icrc1::Account::from(my_principal);

    let args = ic_icrc1::endpoints::TransferArg {
        from_subaccount: None,
        to: transaction.to.clone(),
        fee: Some(transaction.fee.e8s().into()),
        created_at_time: Some(transaction.created),
        memo: transaction.memo.map(|m| ic_icrc1::Memo::from(m.0)),
        amount: transaction.amount.e8s().into(),
    };

    let transaction_hash = ic_icrc1::Transaction {
        operation: ic_icrc1::Operation::Transfer {
            from: from.clone(),
            to: transaction.to.clone(),
            amount: transaction.amount.e8s(),
            fee: Some(transaction.fee.e8s()),
        },
        created_at_time: Some(transaction.created),
        memo: args.memo.clone(),
    }
    .hash()
    .into_bytes();

    let client = ic_icrc1_client::ICRC1Client {
        ledger_canister_id,
        runtime: ic_icrc1_client_cdk::CdkRuntime,
    };

    match client.transfer(args).await {
        Ok(Ok(block_index)) => Ok(CompletedCryptoTransaction::SNS(types::sns::CompletedCryptoTransaction {
            token: transaction.token,
            amount: transaction.amount,
            fee: transaction.fee,
            from: types::sns::CryptoAccount::Account(from.clone()),
            to: types::sns::CryptoAccount::Account(transaction.to.clone()),
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
