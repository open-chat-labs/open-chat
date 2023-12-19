use crate::{read_state, RuntimeState};
use community_canister::local_user_index::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn local_user_index(_args: Args) -> Response {
    read_state(local_user_index_impl)
}

fn local_user_index_impl(state: &RuntimeState) -> Response {
    Success(state.data.local_user_index_canister_id)
}
