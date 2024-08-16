use icrc_ledger_types::icrc1::transfer::TransferArg;
use icrc_ledger_types::icrc1::transfer::TransferError;
use tracing::error;
use types::icrc1::Account;
use types::{
    icrc1::{CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction},
    CanisterId,
};

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
    sender: CanisterId,
    retry_if_bad_fee: bool,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    let from = Account::from(sender);

    let args = TransferArg {
        from_subaccount: None,
        to: transaction.to.into(),
        fee: Some(transaction.fee.into()),
        created_at_time: Some(transaction.created),
        memo: transaction.memo.clone(),
        amount: transaction.amount.into(),
    };

    match make_transfer(transaction.ledger, &args, retry_if_bad_fee).await {
        Ok(block_index) => Ok(CompletedCryptoTransaction {
            ledger: transaction.ledger,
            token: transaction.token.clone(),
            amount: transaction.amount,
            fee: transaction.fee,
            from: from.into(),
            to: transaction.to.into(),
            memo: transaction.memo.clone(),
            created: transaction.created,
            block_index,
        }),
        Err((error_message, _)) => Err(error_message),
    }
    .map_err(|error| FailedCryptoTransaction {
        ledger: transaction.ledger,
        token: transaction.token,
        amount: transaction.amount,
        fee: transaction.fee,
        from: from.into(),
        to: transaction.to.into(),
        memo: transaction.memo,
        created: transaction.created,
        error_message: error,
    })
}

// Error response contains the error message and a boolean stating if the transfer should be retried
pub async fn make_transfer(
    ledger_canister_id: CanisterId,
    args: &TransferArg,
    retry_if_bad_fee: bool,
) -> Result<u64, (String, bool)> {
    let mut response = icrc_ledger_canister_c2c_client::icrc1_transfer(ledger_canister_id, args).await;

    if retry_if_bad_fee {
        // If the ledger returns an error saying the fee is too high, reduce the fee and try again
        if let Ok(Err(TransferError::BadFee { expected_fee })) = &response {
            if let Some(fee) = args.fee.clone() {
                let expected_fee = expected_fee.clone();
                let mut updated_args = args.clone();
                updated_args.fee = Some(expected_fee.clone());

                if fee > expected_fee {
                    let diff = fee - expected_fee;
                    updated_args.amount += diff;
                } else {
                    let diff = expected_fee - fee;
                    if updated_args.amount < diff {
                        return Err(("Transfer amount too low to cover fee".to_string(), false));
                    }
                    updated_args.amount -= diff;
                }
                response = icrc_ledger_canister_c2c_client::icrc1_transfer(ledger_canister_id, &updated_args).await;
            }
        }
    }

    match response {
        Ok(Ok(block_index)) => Ok(block_index.0.try_into().unwrap()),
        Ok(Err(transfer_error)) => {
            error!(?transfer_error, ?args, "Transfer failed");
            Err((format!("Transfer failed. {transfer_error:?}"), false))
        }
        Err((code, msg)) => {
            error!(?code, ?msg, ?args, "Transfer failed");
            Err((format!("Transfer failed. {code:?}: {msg}"), true))
        }
    }
}
