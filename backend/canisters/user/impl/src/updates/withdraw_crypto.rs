use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::model::pin_number::VerifyPinError;
use crate::{mutate_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::withdraw_crypto_v2::{Response::*, *};
use utils::consts::MEMO_SEND;

#[update(guard = "caller_is_owner")]
#[trace]
async fn withdraw_crypto_v2(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| state.data.pin_number.verify(args.pin_attempt.as_deref(), state.env.now())) {
        return match error {
            VerifyPinError::PinRequired => PinRequired,
            VerifyPinError::PinIncorrect(delay) => PinIncorrect(delay),
            VerifyPinError::TooManyFailedAttempted(delay) => TooManyFailedPinAttempts(delay),
        };
    }

    match process_transaction(args.withdrawal.set_memo(&MEMO_SEND)).await {
        Ok(completed_withdrawal) => Success(completed_withdrawal),
        Err(failed_withdrawal) => TransactionFailed(failed_withdrawal),
    }
}
