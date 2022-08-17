use crate::read_state;
use ic_ledger_types::{Memo, Timestamp, TransferArgs, DEFAULT_FEE};
use ledger_utils::{calculate_transaction_hash, default_ledger_account};
use types::{nns, CompletedCryptoTransactionV2, FailedCryptoTransactionV2, PendingCryptoTransactionV2, UserId};

pub async fn process_transaction(
    transaction: PendingCryptoTransactionV2,
) -> Result<CompletedCryptoTransactionV2, FailedCryptoTransactionV2> {
    let PendingCryptoTransactionV2::NNS(t) = transaction;

    let (my_user_id, ledger_canister_id, now) = read_state(|state| {
        if !state.is_caller_owner() {
            panic!("Only the owner can transfer cryptocurrency");
        }

        let my_user_id: UserId = state.env.canister_id().into();
        let ledger_canister_id = state.data.ledger_canister_id;
        let now = state.env.now();

        (my_user_id, ledger_canister_id, now)
    });

    let memo = t.memo.unwrap_or(Memo(0));
    let fee = t.fee.unwrap_or(DEFAULT_FEE);

    let from = default_ledger_account(my_user_id.into());
    let to = match t.to {
        nns::UserOrAccount::User(u) => default_ledger_account(u.into()),
        nns::UserOrAccount::Account(a) => a,
    };

    let transfer_args = TransferArgs {
        memo,
        amount: t.amount,
        fee,
        from_subaccount: None,
        to,
        created_at_time: Some(Timestamp {
            timestamp_nanos: now * 1000 * 1000,
        }),
    };

    let transaction_hash = calculate_transaction_hash(my_user_id, &transfer_args);

    match ic_ledger_types::transfer(ledger_canister_id, transfer_args).await {
        Ok(Ok(block_index)) => Ok(CompletedCryptoTransactionV2::NNS(nns::CompletedCryptoTransaction {
            token: t.token,
            amount: t.amount,
            fee,
            from: nns::CryptoAccount::Account(from),
            to: nns::CryptoAccount::Account(to),
            memo,
            created: now,
            transaction_hash,
            block_index,
        })),
        Ok(Err(transfer_error)) => {
            let error_message = format!("Transfer failed. {transfer_error:?}");
            Err(error_message)
        }
        Err((code, msg)) => {
            let error_message = format!("Transfer failed. {code:?}: {msg}");
            Err(error_message)
        }
    }
    .map_err(|error| {
        FailedCryptoTransactionV2::NNS(nns::FailedCryptoTransaction {
            token: t.token,
            amount: t.amount,
            fee,
            from: nns::CryptoAccount::Account(from),
            to: nns::CryptoAccount::Account(to),
            memo,
            created: now,
            transaction_hash,
            error_message: error,
        })
    })
}
