use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use oc_error_codes::{OCError, OCErrorCode};
use tracing::error;
use types::{
    C2CError, UserId,
    icrc1::Account,
    icrc2::{CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction, TransferFromError},
};

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
    spender: Option<UserId>,
) -> Result<Result<CompletedCryptoTransaction, (FailedCryptoTransaction, OCError)>, C2CError> {
    let spender = crate::resolve_sender(spender);

    let args = TransferFromArgs {
        // The owner is implied by the caller, so only the subaccount goes in the args. Note this
        // picks which approval is spent - `icrc2_approve` grants to an exact (owner, subaccount)
        // pair, so a non-default subaccount here can only spend an approval that named it.
        spender_subaccount: Account::for_user(spender).subaccount,
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
            token_symbol: transaction.token_symbol,
            amount: transaction.amount,
            fee: transaction.fee,
            spender,
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
            // Map the failure to an error code while we still have it typed - it only survives as a
            // string beyond this point. Insufficient funds or too small an approval are the failures
            // a client can act on when pulling from an external wallet, so they get their own codes.
            let error = match &transfer_error {
                TransferFromError::InsufficientFunds { .. } => OCErrorCode::InsufficientFunds.into(),
                TransferFromError::InsufficientAllowance { .. } => OCErrorCode::InsufficientAllowance.into(),
                _ => OCErrorCode::TransferFailed.with_message(&error_message),
            };
            Err((
                FailedCryptoTransaction {
                    ledger: transaction.ledger,
                    token_symbol: transaction.token_symbol,
                    amount: transaction.amount,
                    fee: transaction.fee,
                    spender,
                    from: transaction.from.into(),
                    to: transaction.to.into(),
                    memo: transaction.memo,
                    created: transaction.created,
                    error_message,
                },
                error,
            ))
        }
    })
}
