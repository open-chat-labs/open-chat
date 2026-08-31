use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT, Memo, Subaccount, Timestamp, TransferArgs};
use types::icrc1::Account;
use types::nns::Tokens;
use types::{C2CError, CompletedCryptoTransaction, FailedCryptoTransaction};

pub async fn process_transaction(
    transaction: types::nns::PendingCryptoTransaction,
    sender: Account,
) -> Result<Result<CompletedCryptoTransaction, FailedCryptoTransaction>, C2CError> {
    let memo = transaction.memo.unwrap_or_default();
    let fee = transaction.fee.unwrap_or(Tokens::DEFAULT_FEE);

    let from = AccountIdentifier::new(&sender.owner, &sender.subaccount.map_or(DEFAULT_SUBACCOUNT, Subaccount));
    let to = match transaction.to {
        types::nns::UserOrAccount::User(u) => u.into(),
        types::nns::UserOrAccount::Account(a) => a,
    };

    let transfer_args = TransferArgs {
        memo: Memo(memo),
        amount: transaction.amount.into(),
        fee: fee.into(),
        // The ledger takes the owner from the caller, so the subaccount is the only part of
        // `sender` it lets us choose.
        from_subaccount: sender.subaccount.map(Subaccount),
        to,
        created_at_time: Some(Timestamp {
            timestamp_nanos: transaction.created,
        }),
    };

    let response = icp_ledger_canister_c2c_client::transfer(transaction.ledger, &transfer_args).await?;
    match response {
        Ok(block_index) => Ok(Ok(CompletedCryptoTransaction::NNS(types::nns::CompletedCryptoTransaction {
            ledger: transaction.ledger,
            token_symbol: transaction.token_symbol,
            amount: transaction.amount,
            fee,
            from: types::nns::CryptoAccount::Account(from),
            to: types::nns::CryptoAccount::Account(to),
            memo,
            created: transaction.created,
            transaction_hash: [0; 32],
            block_index,
        }))),
        Err(transfer_error) => {
            let error_message = format!("Transfer failed. {transfer_error:?}");
            Ok(Err(FailedCryptoTransaction::NNS(types::nns::FailedCryptoTransaction {
                ledger: transaction.ledger,
                token_symbol: transaction.token_symbol,
                amount: transaction.amount,
                fee,
                from: types::nns::CryptoAccount::Account(from),
                to: types::nns::CryptoAccount::Account(to),
                memo,
                created: transaction.created,
                transaction_hash: [0; 32],
                error_message,
            })))
        }
    }
}
