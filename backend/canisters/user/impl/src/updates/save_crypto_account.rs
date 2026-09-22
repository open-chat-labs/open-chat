use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::save_crypto_account::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn save_crypto_account(args: Args) -> Response {
    execute_update(|state| save_crypto_account_impl(args, state)).into()
}

fn save_crypto_account_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    user_core::updates::save_crypto_account(&mut state.data.user, args)
}
