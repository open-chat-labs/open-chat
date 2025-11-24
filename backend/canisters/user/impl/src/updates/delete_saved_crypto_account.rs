use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::delete_saved_crypto_account::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn delete_saved_crypto_account(args: Args) -> Response {
    execute_update(|state| delete_saved_crypto_account_impl(args, state)).into()
}

fn delete_saved_crypto_account_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let name_lowercase = args.name.to_lowercase();
    state
        .data
        .saved_crypto_accounts
        .retain(|named| named.name.to_lowercase() != name_lowercase);

    Ok(())
}
