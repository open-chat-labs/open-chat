use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use notifications_index_canister::fcm_token_exists::{Response::*, *};
use stable_memory_map::StableMemoryMap;

#[query(msgpack = true)]
fn fcm_token_exists(args: Args) -> Response {
    read_state(|state| fcm_token_exists_impl(args, state))
}

fn fcm_token_exists_impl(args: Args, state: &RuntimeState) -> Response {
    state.data.fcm_token_store.check_token_exists(&args.fcm_token)
}
