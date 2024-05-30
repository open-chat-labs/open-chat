use crate::{read_state, RuntimeState};
use ic_cdk::query;
use user_canister::saved_crypto_accounts::{Response::*, *};

#[query]
fn saved_crypto_accounts(_args: Args) -> Response {
    read_state(saved_crypto_accounts_impl)
}

fn saved_crypto_accounts_impl(state: &RuntimeState) -> Response {
    Success(state.data.saved_crypto_accounts.clone())
}
