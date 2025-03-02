use ic_cdk::call::RejectCode;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use tracing::error;
use types::{
    icrc2::{CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction},
    CanisterId,
};

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
    sender: CanisterId,
) -> Result<Result<CompletedCryptoTransaction, FailedCryptoTransaction>, (RejectCode, String)> {
    let args = TransferFromArgs {
        spender_subaccount: None,
        from: transaction.from.into(),
        to: transaction.to.into(),
        fee: Some(transaction.fee.into()),
        created_at_time: Some(transaction.created),
        memo: transaction.memo.clone(),
        amount: transaction.amount.into(),
    };

    let response = icrc_ledger_canister_c2c_client::icrc2_transfer_from(transaction.ledger, &args).await?;
    Ok(match response {
        Ok(block_index) => Ok(CompletedCryptoTransaction {
            ledger: transaction.ledger,
            token: transaction.token.clone(),
            amount: transaction.amount,
            fee: transaction.fee,
            spender: sender.into(),
            from: transaction.from.into(),
            to: transaction.to.into(),
            memo: transaction.memo.clone(),
            created: transaction.created,
            block_index: block_index.0.try_into().unwrap(),
        }),
        Err(transfer_error) => {
            error!(
                ledger_canister_id = %transaction.ledger,
                ?transfer_error,
                ?args,
                "Transfer failed"
            );
            let error_message = format!("Transfer failed. {transfer_error:?}");
            Err(FailedCryptoTransaction {
                ledger: transaction.ledger,
                token: transaction.token,
                amount: transaction.amount,
                fee: transaction.fee,
                spender: sender.into(),
                from: transaction.from.into(),
                to: transaction.to.into(),
                memo: transaction.memo,
                created: transaction.created,
                error_message,
            })
        }
    })
}
