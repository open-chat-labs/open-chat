use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use notifications_index_canister::notification_canisters::*;

#[query(msgpack = true)]
fn notification_canisters(_args: Args) -> Response {
    read_state(notification_canisters_impl)
}

fn notification_canisters_impl(state: &RuntimeState) -> Response {
    state.data.local_indexes.iter().copied().collect()
}
