use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_push_wasm_chunk::{Response::*, *};

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_push_wasm_chunk(args: Args) -> Response {
    mutate_state(|state| c2c_push_wasm_chunk_impl(args, state))
}

fn c2c_push_wasm_chunk_impl(args: Args, state: &mut RuntimeState) -> Response {
    match state
        .data
        .child_canister_wasms
        .push_chunk(args.canister_type, args.chunk, args.index)
    {
        Ok(_) => Success,
        Err(expected_index) => UnexpectedIndex(expected_index),
    }
}
