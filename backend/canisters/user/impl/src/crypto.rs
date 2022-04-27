use crate::{mutate_state, read_state};
use ic_ledger_types::{Memo, Timestamp, TransferArgs, DEFAULT_FEE, MAINNET_LEDGER_CANISTER_ID};
use ledger_utils::{calculate_transaction_hash, default_ledger_account};
use types::cryptocurrency_v2::{
    CompletedCryptocurrencyTransfer, CompletedCryptocurrencyWithdrawal, CryptocurrencyTransfer, CryptocurrencyWithdrawal,
    FailedCryptocurrencyTransfer, FailedCryptocurrencyWithdrawal, PendingCryptocurrencyTransfer,
    PendingCryptocurrencyWithdrawal,
};
use types::UserId;

pub enum TransferError {
    InvalidRequest(String),
    TransferFailed(FailedCryptocurrencyTransfer),
}

pub async fn process_transfer(
    transfer: CryptocurrencyTransfer,
    recipient: UserId,
) -> Result<CompletedCryptocurrencyTransfer, TransferError> {
    read_state(|state| {
        if !state.is_caller_owner() {
            panic!("Only the owner can transfer cryptocurrency");
        }
    });

    if transfer.recipient() != recipient {
        Err(TransferError::InvalidRequest(
            "Transfer recipient does not match message recipient".to_string(),
        ))
    } else if let CryptocurrencyTransfer::Pending(t) = transfer {
        send_to_ledger(t).await.map_err(TransferError::TransferFailed)
    } else {
        Err(TransferError::InvalidRequest("Can only send pending transfers".to_string()))
    }
}

async fn send_to_ledger(
    pending_transfer: PendingCryptocurrencyTransfer,
) -> Result<CompletedCryptocurrencyTransfer, FailedCryptocurrencyTransfer> {
    let (my_user_id, transaction_index, now) = mutate_state(|state| {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();
        let crypto_transfer = CryptocurrencyTransfer::Pending(pending_transfer.clone());
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
        to: default_ledger_account(pending_transfer.recipient.into()),
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
        let crypto_transfer = match transfer_result.clone() {
            Ok(completed) => CryptocurrencyTransfer::Completed(completed),
            Err(failed) => CryptocurrencyTransfer::Failed(failed),
        };
        state.data.transactions.update(transaction_index, crypto_transfer);
    });

    transfer_result
}

pub async fn withdraw(
    pending_withdrawal: PendingCryptocurrencyWithdrawal,
) -> Result<CompletedCryptocurrencyWithdrawal, FailedCryptocurrencyWithdrawal> {
    let memo = pending_withdrawal.memo.unwrap_or(Memo(0));
    let fee = pending_withdrawal.fee.unwrap_or(DEFAULT_FEE);
    let (my_user_id, transaction_index, now) = mutate_state(|state| {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();
        let crypto_transfer = CryptocurrencyWithdrawal::Pending(pending_withdrawal.clone());
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
        let crypto_withdrawal = match withdrawal_result.clone() {
            Ok(completed) => CryptocurrencyWithdrawal::Completed(completed),
            Err(failed) => CryptocurrencyWithdrawal::Failed(failed),
        };
        state.data.transactions.update(transaction_index, crypto_withdrawal);
    });

    withdrawal_result
}
