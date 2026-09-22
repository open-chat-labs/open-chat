use crate::crypto::use_transfer;
use crate::guards::caller_is_hosted_user;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::withdraw_crypto_v2::{Response::*, *};

// The user makes the withdrawal themselves from their own account, so this only verifies it
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn withdraw_crypto_v2(args: Args) -> Response {
    mutate_state(|state| {
        let principal = state.with_caller_user(|_, user| user.principal);
        match use_transfer(args.withdrawal, principal, state) {
            Ok(completed) => Success(Box::new(completed.into())),
            Err(error) => Error(error),
        }
    })
}
