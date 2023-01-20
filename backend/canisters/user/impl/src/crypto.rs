use crate::read_state;
use candid::Principal;
use types::{
    CanisterId, CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction, TimestampMillis, UserId,
};

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    process_transaction_internal(transaction, true).await
}

// `process_transaction` should be used whenever possible.
// Only call `process_transaction_without_caller_check` if an async operation has already been
// processed as part of the currently executing update call, since in that scenario we are within a
// reply callback and therefore are not able to access the original `caller`.
// If calling this method, ensure that the caller has been validated earlier on.
pub async fn process_transaction_without_caller_check(
    transaction: PendingCryptoTransaction,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    process_transaction_internal(transaction, false).await
}

async fn process_transaction_internal(
    transaction: PendingCryptoTransaction,
    check_caller: bool,
) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
    let (my_user_id, ledger_canister_id, now) = read_state(|state| {
        if check_caller && state.env.caller() != state.data.owner {
            panic!("Only the owner can transfer cryptocurrency");
        }

        let my_user_id: UserId = state.env.canister_id().into();
        let ledger_canister_id = state.data.ledger_canister_id(&transaction.token());
        let now = state.env.now();

        (my_user_id, ledger_canister_id, now)
    });

    match transaction {
        PendingCryptoTransaction::NNS(t) => nns::process_transaction(t, my_user_id, ledger_canister_id, now).await,
        PendingCryptoTransaction::SNS(t) => sns::process_transaction(t, my_user_id, ledger_canister_id, now).await,
    }
}

mod nns {
    use super::*;
    use ic_ledger_types::{Memo, Timestamp, TransferArgs, DEFAULT_FEE};
    use ledger_utils::{calculate_transaction_hash, default_ledger_account};

    pub async fn process_transaction(
        transaction: types::nns::PendingCryptoTransaction,
        my_user_id: UserId,
        ledger_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
        let memo = transaction.memo.unwrap_or(Memo(0));
        let fee = transaction.fee.unwrap_or(DEFAULT_FEE);

        let from = default_ledger_account(my_user_id.into());
        let to = match transaction.to {
            types::nns::UserOrAccount::User(u) => default_ledger_account(u.into()),
            types::nns::UserOrAccount::Account(a) => a,
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
            Ok(Ok(block_index)) => Ok(CompletedCryptoTransaction::NNS(types::nns::CompletedCryptoTransaction {
                token: transaction.token,
                amount: transaction.amount,
                fee,
                from: types::nns::CryptoAccount::Account(from),
                to: types::nns::CryptoAccount::Account(to),
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
            FailedCryptoTransaction::NNS(types::nns::FailedCryptoTransaction {
                token: transaction.token,
                amount: transaction.amount,
                fee,
                from: types::nns::CryptoAccount::Account(from),
                to: types::nns::CryptoAccount::Account(to),
                memo,
                created: now,
                transaction_hash,
                error_message: error,
            })
        })
    }
}

mod sns {
    use super::*;
    use ic_ledger_canister_core::ledger::LedgerTransaction;

    pub async fn process_transaction(
        transaction: types::sns::PendingCryptoTransaction,
        my_user_id: UserId,
        ledger_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> Result<CompletedCryptoTransaction, FailedCryptoTransaction> {
        let my_principal = ic_base_types::PrincipalId::from(Principal::from(my_user_id));
        let from = ic_icrc1::Account::from(my_principal);

        let args = ic_icrc1::endpoints::TransferArg {
            from_subaccount: None,
            to: transaction.to.clone(),
            fee: Some(transaction.fee.e8s().into()),
            created_at_time: Some(now * 1000 * 1000),
            memo: transaction.memo.map(|m| ic_icrc1::Memo::from(m.0)),
            amount: transaction.amount.e8s().into(),
        };

        let transaction_hash = ic_icrc1::Transaction {
            operation: ic_icrc1::Operation::Transfer {
                from: from.clone(),
                to: transaction.to.clone(),
                amount: transaction.amount.e8s(),
                fee: transaction.fee.e8s(),
            },
            created_at_time: Some(now),
            memo: args.memo.clone(),
        }
        .hash()
        .into_bytes();

        let client = ic_icrc1_client::ICRC1Client {
            ledger_canister_id,
            runtime: ic_icrc1_client_cdk::CdkRuntime,
        };

        match client.transfer(args).await {
            Ok(Ok(block_index)) => Ok(CompletedCryptoTransaction::SNS(types::sns::CompletedCryptoTransaction {
                token: transaction.token,
                amount: transaction.amount,
                fee: transaction.fee,
                from: types::sns::CryptoAccount::Account(from.clone()),
                to: types::sns::CryptoAccount::Account(transaction.to.clone()),
                memo: transaction.memo,
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
            FailedCryptoTransaction::SNS(types::sns::FailedCryptoTransaction {
                token: transaction.token,
                amount: transaction.amount,
                fee: transaction.fee,
                from: types::sns::CryptoAccount::Account(from),
                to: types::sns::CryptoAccount::Account(transaction.to),
                memo: transaction.memo,
                created: now,
                transaction_hash,
                error_message: error,
            })
        })
    }
}
