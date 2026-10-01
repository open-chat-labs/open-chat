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

async fn withdraw_crypto_impl(mut args: Args) -> Response {
    // A user in a MultiUser canister holds their funds under their principal, and no one can spend
    // from an account of their user id, so a withdrawal to one would be lost
    if args.withdrawal.is_to_indexed_user_id() {
        return Error(OCErrorCode::InvalidRequest.with_message(
            "The recipient is the id of a user in a MultiUser canister, which no one can spend from, rather than their wallet",
        ));
    }

    if let Err(error) = mutate_state(|state| state.data.user.pin_number.verify(args.pin.as_mut(), state.env.now())) {
        return Error(error.into());
    }

    match process_transaction(args.withdrawal.set_memo(&MEMO_SEND)).await {
        Ok(Ok(completed_withdrawal)) => Success(Box::new(completed_withdrawal)),
        Ok(Err((failed_withdrawal, _))) => Error(OCErrorCode::TransferFailed.with_json(&failed_withdrawal)),
        Err(error) => Error(error.into()),
    }
}
