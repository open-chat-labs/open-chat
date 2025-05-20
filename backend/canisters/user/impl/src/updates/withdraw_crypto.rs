use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MEMO_SEND;
use oc_error_codes::OCErrorCode;
use user_canister::withdraw_crypto_v2::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn withdraw_crypto_v2(args: Args) -> Response {
    execute_update_async(|| withdraw_crypto_impl(args)).await
}

async fn withdraw_crypto_impl(args: Args) -> Response {
    if let Err(error) = mutate_state(|state| state.data.pin_number.verify(args.pin.as_deref(), state.env.now())) {
        return Error(error.into());
    }

    match process_transaction(args.withdrawal.set_memo(&MEMO_SEND)).await {
        Ok(Ok(completed_withdrawal)) => Success(Box::new(completed_withdrawal)),
        Ok(Err(failed_withdrawal)) => Error(OCErrorCode::TransferFailed.with_json(&failed_withdrawal)),
        Err(error) => Error(error.into()),
    }
}
