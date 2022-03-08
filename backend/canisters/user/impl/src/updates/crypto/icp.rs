use crate::mutate_state;
use ic_ledger_types::{
    AccountIdentifier, Memo, Timestamp, TransferArgs, DEFAULT_FEE, DEFAULT_SUBACCOUNT, MAINNET_LEDGER_CANISTER_ID,
};
use ledger_utils::transaction_hash;
use types::{
    CompletedICPTransfer, CryptocurrencyTransfer, FailedICPTransfer, ICPTransfer, PendingICPTransfer, TimestampMillis,
};
use utils::consts::DEFAULT_MEMO;

pub async fn send_icp(
    pending_transfer: PendingICPTransfer,
    now: TimestampMillis,
) -> Result<CompletedICPTransfer, FailedICPTransfer> {
    let (my_user_id, index) = mutate_state(|state| {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();
        let crypto_transfer = CryptocurrencyTransfer::ICP(ICPTransfer::Pending(pending_transfer.clone()));
        let index = state.data.transactions.add(crypto_transfer, now);

        (my_user_id, index)
    });

    let memo = pending_transfer.memo.unwrap_or(Memo(DEFAULT_MEMO));
    let fee = pending_transfer.fee.unwrap_or(DEFAULT_FEE);

    let transfer_args = TransferArgs {
        memo,
        amount: pending_transfer.amount,
        fee,
        from_subaccount: None,
        to: AccountIdentifier::new(&pending_transfer.recipient.into(), &DEFAULT_SUBACCOUNT),
        created_at_time: Some(Timestamp {
            timestamp_nanos: now * 1000 * 1000,
        }),
    };

    let transaction_hash = transaction_hash(my_user_id, &transfer_args);

    let transfer_result = match ic_ledger_types::transfer(MAINNET_LEDGER_CANISTER_ID, transfer_args).await {
        Ok(Ok(block_index)) => {
            let completed_transfer = pending_transfer.completed(my_user_id, fee, memo, block_index, transaction_hash);
            Ok(completed_transfer)
        }
        Ok(Err(transfer_error)) => {
            let error_message = format!("Transfer failed. {transfer_error:?}");
            let failed_transfer = pending_transfer.failed(fee, memo, error_message);
            Err(failed_transfer)
        }
        Err((code, msg)) => {
            let error_message = format!("Transfer failed. {code:?}: {msg}");
            let failed_transfer = pending_transfer.failed(fee, memo, error_message);
            Err(failed_transfer)
        }
    };

    mutate_state(|state| {
        let crypto_transfer = CryptocurrencyTransfer::ICP(match transfer_result.clone() {
            Ok(completed) => ICPTransfer::Completed(completed),
            Err(failed) => ICPTransfer::Failed(failed),
        });
        state.data.transactions.update(index, crypto_transfer);
    });

    transfer_result
}
