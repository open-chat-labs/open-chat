use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use user_canister::saved_crypto_accounts::{Response::*, *};

#[query(guard = "caller_is_owner", candid = true, msgpack = true)]
fn saved_crypto_accounts(_args: Args) -> Response {
    read_state(saved_crypto_accounts_impl)
}

fn saved_crypto_accounts_impl(state: &RuntimeState) -> Response {
    Success(state.data.saved_crypto_accounts.clone())
}
