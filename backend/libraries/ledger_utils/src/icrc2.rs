use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use tracing::error;
use types::{
    C2CError, UserId,
    icrc1::Account,
    icrc2::{CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction},
};

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
    spender: Account,
) -> Result<Result<CompletedCryptoTransaction, FailedCryptoTransaction>, C2CError> {
    // The recorded spender is a UserId, which cannot carry an arbitrary subaccount, so it holds the
    // owner alone. Nothing is lost today because every caller spends from its default subaccount.
    let spender_user_id = UserId::from(spender.owner);

    let args = TransferFromArgs {
        // The ledger takes the spender's owner from the caller, so the subaccount is the only part
        // of `spender` it lets us choose. Note this picks which approval is spent - `icrc2_approve`
        // grants to an exact (owner, subaccount) pair, so a non-default subaccount here can only
        // spend an approval that named it.
        spender_subaccount: spender.subaccount,
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
            spender: spender_user_id,
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
                token_symbol: transaction.token_symbol,
                amount: transaction.amount,
                fee: transaction.fee,
                spender: spender_user_id,
                from: transaction.from.into(),
                to: transaction.to.into(),
                memo: transaction.memo,
                created: transaction.created,
                error_message,
            })
        }
    })
}
