use crate::crypto::process_transaction;
use crate::guards::caller_is_hosted_user;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MEMO_SEND;
use oc_error_codes::OCErrorCode;
use user_canister::withdraw_crypto_v2::{Response::*, *};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn withdraw_crypto_v2(mut args: Args) -> Response {
    let me = match mutate_state(|state| {
        let now = state.env.now();
        let canister_id = state.env.canister_id();
        state.with_caller_user_mut(|my_index, user| {
            user.pin_number
                .verify(args.pin.as_mut(), now)
                .map(|()| types::UserIdAndPrincipal::new(types::UserId::new_indexed(canister_id, my_index), user.principal))
        })
    }) {
        Ok(me) => me,
        Err(error) => return Error(error.into()),
    };

    match process_transaction(args.withdrawal.set_memo(&MEMO_SEND), me).await {
        Ok(Ok(completed_withdrawal)) => Success(Box::new(completed_withdrawal)),
        Ok(Err((failed_withdrawal, _))) => Error(OCErrorCode::TransferFailed.with_json(&failed_withdrawal)),
        Err(error) => Error(error.into()),
    }
}
