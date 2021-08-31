use crate::updates::put_chunk::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::put_chunk::*;
use ic_cdk_macros::update;
use utils::blob_storage::PutChunkResult;

#[update]
fn put_chunk(args: Args) -> Response {
    RUNTIME_STATE.with(|state| put_chunk_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn put_chunk_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    match runtime_state
        .data
        .blob_storage
        .put_chunk(args.blob_id, args.index, args.bytes)
    {
        PutChunkResult::Success => Success,
        PutChunkResult::ChunkTooBig => ChunkTooBig,
        PutChunkResult::Full => Full,
    }
}
