use crate::read_state;
use canister_api_macros::query;
use user_canister::bio::{Response::*, *};

#[query(msgpack = true)]
fn bio(_args: Args) -> Response {
    read_state(|state| Success(state.data.bio.value.clone()))
}
