use crate::guards::caller_is_owner;
use crate::run_regular_jobs;
use crate::updates::crypto::icp::withdraw_icp;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::{CompletedCryptocurrencyWithdrawal, FailedCryptocurrencyWithdrawal, PendingCryptocurrencyWithdrawal};
use user_canister::withdraw_cryptocurrency::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn withdraw_cryptocurrency(args: Args) -> Response {
    run_regular_jobs();

    match args.withdrawal {
        PendingCryptocurrencyWithdrawal::ICP(pending_withdrawal) => match withdraw_icp(pending_withdrawal).await {
            Ok(completed_withdrawal) => Success(CompletedCryptocurrencyWithdrawal::ICP(completed_withdrawal)),
            Err(failed_withdrawal) => TransactionFailed(FailedCryptocurrencyWithdrawal::ICP(failed_withdrawal)),
        },
        _ => CurrencyNotSupported,
    }
}
