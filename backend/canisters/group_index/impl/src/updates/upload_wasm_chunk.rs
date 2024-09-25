use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use group_index_canister::upload_wasm_chunk::{Response::*, *};
use ic_cdk::update;

#[update]
#[trace]
fn upload_wasm_chunk(args: Args) -> Response {
    mutate_state(|state| upload_wasm_chunk_impl(args, state))
}

fn upload_wasm_chunk_impl(args: Args, state: &mut RuntimeState) -> Response {
    match state
        .data
        .child_canister_wasms
        .push_chunk(args.canister_type, args.chunk, args.index)
    {
        Ok(hash) => Success(hash),
        Err(expected_index) => UnexpectedIndex(expected_index),
    }
}
