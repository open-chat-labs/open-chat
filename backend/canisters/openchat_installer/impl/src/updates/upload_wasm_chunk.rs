use crate::guards::caller_can_upload_wasm_chunks;
use crate::{mutate_state, State};
use canister_tracing_macros::trace;
use ic_cdk::update;
use openchat_installer_canister::upload_wasm_chunk::{Response::*, *};

#[update(guard = "caller_can_upload_wasm_chunks")]
#[trace]
fn upload_wasm_chunk(args: Args) -> Response {
    mutate_state(|state| upload_wasm_chunk_impl(args, state))
}

fn upload_wasm_chunk_impl(args: Args, state: &mut State) -> Response {
    match state
        .data
        .canister_wasms
        .push_chunk(args.canister_type, args.chunk, args.index)
    {
        Ok((total_bytes, hash)) => Success(SuccessResult { total_bytes, hash }),
        Err(expected_index) => UnexpectedIndex(expected_index),
    }
}
