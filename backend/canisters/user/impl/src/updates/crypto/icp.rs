use crate::mutate_state;
use ic_ledger_types::{
    AccountIdentifier, Memo, Timestamp, TransferArgs, DEFAULT_FEE, DEFAULT_SUBACCOUNT, MAINNET_LEDGER_CANISTER_ID,
};
use ledger_utils::calculate_transaction_hash;
use types::{
    CompletedICPTransfer, CompletedICPWithdrawal, CryptocurrencyTransfer, CryptocurrencyWithdrawal, FailedICPTransfer,
    FailedICPWithdrawal, ICPTransfer, ICPWithdrawal, PendingICPTransfer, PendingICPWithdrawal,
};

pub async fn send_icp(pending_transfer: PendingICPTransfer) -> Result<CompletedICPTransfer, FailedICPTransfer> {
    let (my_user_id, transaction_index, now) = mutate_state(|state| {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();
        let crypto_transfer = CryptocurrencyTransfer::ICP(ICPTransfer::Pending(pending_transfer.clone()));
        let transaction_index = state.data.transactions.add(crypto_transfer, now);

        (my_user_id, transaction_index, now)
    });

    let memo = pending_transfer.memo.unwrap_or(Memo(0));
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

    let transaction_hash = calculate_transaction_hash(my_user_id, &transfer_args);

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
        state.data.transactions.update(transaction_index, crypto_transfer);
    });

    transfer_result
}

pub async fn withdraw_icp(pending_withdrawal: PendingICPWithdrawal) -> Result<CompletedICPWithdrawal, FailedICPWithdrawal> {
    let memo = pending_withdrawal.memo.unwrap_or(Memo(0));
    let fee = pending_withdrawal.fee.unwrap_or(DEFAULT_FEE);
    let (my_user_id, transaction_index, now) = mutate_state(|state| {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();
        let crypto_transfer = CryptocurrencyWithdrawal::ICP(ICPWithdrawal::Pending(pending_withdrawal.clone()));
        let transaction_index = state.data.transactions.add(crypto_transfer, now);

        (my_user_id, transaction_index, now)
    });

    let transfer_args = TransferArgs {
        memo,
        amount: pending_withdrawal.amount,
        fee,
        from_subaccount: None,
        to: pending_withdrawal.to,
        created_at_time: Some(Timestamp {
            timestamp_nanos: now * 1000 * 1000,
        }),
    };

    let transaction_hash = calculate_transaction_hash(my_user_id, &transfer_args);

    let withdrawal_result = match ic_ledger_types::transfer(MAINNET_LEDGER_CANISTER_ID, transfer_args).await {
        Ok(Ok(block_index)) => {
            let completed_withdrawal = pending_withdrawal.completed(fee, memo, block_index, transaction_hash);
            Ok(completed_withdrawal)
        }
        Ok(Err(transfer_error)) => {
            let error_message = format!("Transfer failed. {transfer_error:?}");
            let failed_withdrawal = pending_withdrawal.failed(fee, memo, error_message);
            Err(failed_withdrawal)
        }
        Err((code, msg)) => {
            let error_message = format!("Transfer failed. {code:?}: {msg}");
            let failed_withdrawal = pending_withdrawal.failed(fee, memo, error_message);
            Err(failed_withdrawal)
        }
    };

    mutate_state(|state| {
        let crypto_withdrawal = CryptocurrencyWithdrawal::ICP(match withdrawal_result.clone() {
            Ok(completed) => ICPWithdrawal::Completed(completed),
            Err(failed) => ICPWithdrawal::Failed(failed),
        });
        state.data.transactions.update(transaction_index, crypto_withdrawal);
    });

    withdrawal_result
}
