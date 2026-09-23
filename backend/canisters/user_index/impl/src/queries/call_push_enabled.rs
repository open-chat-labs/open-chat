use crate::read_state;
use canister_api_macros::query;
use user_index_canister::call_push_enabled::{Response::*, *};

#[query(msgpack = true)]
fn call_push_enabled(_args: Args) -> Response {
    Success(read_state(|state| state.data.call_push_enabled))
}
