use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_canister::local_user_index::{Response::*, *};

#[query(msgpack = true)]
fn index_of_local_user(_args: Args) -> Response {
    read_state(local_user_index_impl)
}

fn local_user_index_impl(state: &RuntimeState) -> Response {
    Success(state.data.local_user_index_canister_id)
}
