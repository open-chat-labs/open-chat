use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::delete_crypto_account::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn delete_crypto_account(args: Args) -> Response {
    execute_update(|state| delete_crypto_account_impl(args, state)).into()
}

fn delete_crypto_account_impl(mut args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;
    args = args.trim().to_string();
    state.data.saved_crypto_accounts.retain(|named| named.account.ne(&args));
    Ok(())
}
