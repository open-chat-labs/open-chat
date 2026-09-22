use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::save_crypto_account::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn save_crypto_account(args: Args) -> Response {
    mutate_state(|state| save_crypto_account_impl(args, state)).into()
}

fn save_crypto_account_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.with_caller_user_mut(|_, user| user_core::updates::save_crypto_account(user, args))
}
