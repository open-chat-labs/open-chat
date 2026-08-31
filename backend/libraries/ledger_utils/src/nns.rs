use ic_ledger_types::{AccountIdentifier, Memo, Subaccount, Timestamp, TransferArgs};
use types::icrc1::Account;
use types::nns::Tokens;
use types::{C2CError, CompletedCryptoTransaction, FailedCryptoTransaction, UserId};

pub async fn process_transaction(
    transaction: types::nns::PendingCryptoTransaction,
    sender: Option<UserId>,
) -> Result<Result<CompletedCryptoTransaction, FailedCryptoTransaction>, C2CError> {
    let sender = crate::resolve_sender(sender);
    let memo = transaction.memo.unwrap_or_default();
    let fee = transaction.fee.unwrap_or(Tokens::DEFAULT_FEE);

    let from = AccountIdentifier::from(sender);
    let to = match transaction.to {
        types::nns::UserOrAccount::User(u) => u.into(),
        types::nns::UserOrAccount::Account(a) => a,
    };

    let transfer_args = TransferArgs {
        memo: Memo(memo),
        amount: transaction.amount.into(),
        fee: fee.into(),
        // The owner is implied by the caller, so only the subaccount goes in the args.
        from_subaccount: Account::for_user(sender).subaccount.map(Subaccount),
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
