use crate::{read_state, RuntimeState};
use group_canister::local_user_index::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn local_user_index(_args: Args) -> Response {
    read_state(local_user_index_impl)
}

fn local_user_index_impl(runtime_state: &RuntimeState) -> Response {
    Success(runtime_state.data.local_user_index_canister_id)
}
