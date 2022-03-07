use crate::guards::caller_is_owner;
use crate::run_regular_jobs;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{Memo, TransferArgs, DEFAULT_FEE, MAINNET_LEDGER_CANISTER_ID};
use types::PendingCryptocurrencyWithdrawal;
use user_canister::withdraw::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn withdraw(args: Args) -> Response {
    run_regular_jobs();

    match args.withdrawal {
        PendingCryptocurrencyWithdrawal::ICP(withdrawal) => {
            match ic_ledger_types::transfer(
                MAINNET_LEDGER_CANISTER_ID,
                TransferArgs {
                    memo: withdrawal.memo.unwrap_or(Memo(0)),
                    amount: withdrawal.amount,
                    fee: withdrawal.fee.unwrap_or(DEFAULT_FEE),
                    from_subaccount: None,
                    to: withdrawal.to,
                    created_at_time: None,
                },
            )
            .await
            {
                Ok(Ok(block_index)) => Success(block_index),
                Ok(Err(error)) => TransactionFailed(format!("{error:?}")),
                Err(error) => InternalError(format!("{error:?}")),
            }
        }
        _ => CurrencyNotSupported,
    }
}
