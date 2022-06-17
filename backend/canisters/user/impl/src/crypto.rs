use crate::read_state;
use ic_ledger_types::{Memo, Timestamp, TransferArgs, DEFAULT_FEE};
use ledger_utils::{calculate_transaction_hash, default_ledger_account};
use types::{
    CompletedCryptoTransaction, CryptoAccount, CryptoAccountFull, FailedCryptoTransaction, PendingCryptoTransaction, UserId,
};

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    let (my_user_id, ledger_canister_id, now) = read_state(|state| {
        if !state.is_caller_owner() {
            panic!("Only the owner can transfer cryptocurrency");
        }

        let my_user_id: UserId = state.env.canister_id().into();
        let ledger_canister_id = state.data.ledger_canister_id;
        let now = state.env.now();

        (my_user_id, ledger_canister_id, now)
    });

    let memo = transaction.memo.unwrap_or(Memo(0));
    let fee = transaction.fee.unwrap_or(DEFAULT_FEE);

    let from = default_ledger_account(my_user_id.into());
    let (to, to_full) = match transaction.to {
        CryptoAccount::User(user_id) => {
            let to = default_ledger_account(user_id.into());
            (to, CryptoAccountFull::User(user_id, to))
        }
        CryptoAccount::Account(a) => (a, CryptoAccountFull::Unknown(a)),
        CryptoAccount::Mint => panic!("Burning is not supported yet"),
    };

    let transfer_args = TransferArgs {
        memo,
        amount: transaction.amount,
        fee,
        from_subaccount: None,
        to,
        created_at_time: Some(Timestamp {
            timestamp_nanos: now * 1000 * 1000,
        }),
    };

    let transaction_hash = calculate_transaction_hash(my_user_id, &transfer_args);

    match ic_ledger_types::transfer(ledger_canister_id, transfer_args).await {
        Ok(Ok(block_index)) => Ok(CompletedCryptoTransaction {
            token: transaction.token,
            amount: transaction.amount,
            fee,
            from: CryptoAccountFull::User(my_user_id, from),
            to: to_full.clone(),
            memo,
            created: now,
            transaction_hash,
            block_index,
        }),
        Ok(Err(transfer_error)) => {
            let error_message = format!("Transfer failed. {transfer_error:?}");
            Err(error_message)
        }
        Err((code, msg)) => {
            let error_message = format!("Transfer failed. {code:?}: {msg}");
            Err(error_message)
        }
    }
    .map_err(|error| FailedCryptoTransaction {
        token: transaction.token,
        amount: transaction.amount,
        fee,
        from: CryptoAccountFull::User(my_user_id, from),
        to: to_full,
        memo,
        created: now,
        transaction_hash,
        error_message: error,
    })
}
