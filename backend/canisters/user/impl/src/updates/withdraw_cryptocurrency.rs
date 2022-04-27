use crate::crypto::withdraw;
use crate::guards::caller_is_owner;
use crate::run_regular_jobs;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_canister::withdraw_cryptocurrency::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn withdraw_cryptocurrency(args: Args) -> Response {
    run_regular_jobs();

    match withdraw(args.withdrawal).await {
        Ok(completed_withdrawal) => Success(completed_withdrawal),
        Err(failed_withdrawal) => TransactionFailed(failed_withdrawal),
    }
}
