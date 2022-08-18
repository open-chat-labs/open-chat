use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use ledger_utils::default_ledger_account;
use types::{
    nns, CompletedCryptoTransactionV2, CryptoAccount, FailedCryptoTransactionV2, PendingCryptoTransaction,
    PendingCryptoTransactionV2, UserId,
};
use user_canister::withdraw_crypto::{Response::*, *};
use user_canister::withdraw_crypto_v2 as v2;

#[update(guard = "caller_is_owner")]
#[trace]
async fn withdraw_crypto_v2(args: v2::Args) -> v2::Response {
    let my_user_id: UserId = read_state(|state| state.env.canister_id()).into();
    let PendingCryptoTransactionV2::NNS(p) = args.withdrawal;

    let withdrawal = PendingCryptoTransaction {
        token: p.token,
        amount: p.amount,
        to: match p.to {
            nns::UserOrAccount::User(u) => CryptoAccount::User(u),
            nns::UserOrAccount::Account(a) => CryptoAccount::Account(a),
        },
        fee: p.fee,
        memo: p.memo,
    };

    match withdraw_crypto(Args { withdrawal }).await {
        Success(t) => v2::Response::Success(CompletedCryptoTransactionV2::NNS(nns::CompletedCryptoTransaction {
            token: t.token,
            amount: t.amount,
            fee: t.fee,
            from: nns::CryptoAccount::Account(default_ledger_account(my_user_id.into())),
            to: match p.to {
                nns::UserOrAccount::User(u) => nns::CryptoAccount::Account(default_ledger_account(u.into())),
                nns::UserOrAccount::Account(a) => nns::CryptoAccount::Account(a),
            },
            memo: t.memo,
            created: t.created,
            transaction_hash: t.transaction_hash,
            block_index: t.block_index,
        })),
        TransactionFailed(t) => v2::Response::TransactionFailed(FailedCryptoTransactionV2::NNS(nns::FailedCryptoTransaction {
            token: t.token,
            amount: t.amount,
            fee: t.fee,
            from: nns::CryptoAccount::Account(default_ledger_account(my_user_id.into())),
            to: match p.to {
                nns::UserOrAccount::User(u) => nns::CryptoAccount::Account(default_ledger_account(u.into())),
                nns::UserOrAccount::Account(a) => nns::CryptoAccount::Account(a),
            },
            memo: t.memo,
            created: t.created,
            transaction_hash: t.transaction_hash,
            error_message: t.error_message,
        })),
        CurrencyNotSupported => v2::Response::CurrencyNotSupported,
    }
}

#[update(guard = "caller_is_owner")]
#[trace]
async fn withdraw_crypto(args: Args) -> Response {
    run_regular_jobs();

    match process_transaction(args.withdrawal).await {
        Ok(completed_withdrawal) => Success(completed_withdrawal),
        Err(failed_withdrawal) => TransactionFailed(failed_withdrawal),
    }
}
