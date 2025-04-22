use crate::{RuntimeState, read_state};
use ic_cdk::query;
use user_index_canister::public_key::{Response::*, *};

#[query]
fn public_key(_args: Args) -> Response {
    read_state(public_key_impl)
}

fn public_key_impl(state: &RuntimeState) -> Response {
    if state.data.oc_key_pair.is_initialised() {
        Success(state.data.oc_key_pair.public_key_pem().to_string())
    } else {
        NotInitialised
    }
}
