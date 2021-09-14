use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::put_first_chunk::{Response::*, *};
use ic_cdk_macros::update;
use utils::blob_storage::PutChunkResult;

#[update]
fn put_first_chunk(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| put_first_chunk_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn put_first_chunk_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_participant() {
        let now = runtime_state.env.now();

        match runtime_state
            .data
            .blob_storage
            .put_first_chunk(args.blob_id, args.mime_type, args.total_chunks, args.bytes, now)
        {
            PutChunkResult::Success => Success,
            PutChunkResult::ChunkAlreadyExists => ChunkAlreadyExists,
            PutChunkResult::ChunkTooBig => ChunkTooBig,
            PutChunkResult::Full => Full,
        }
    } else {
        CallerNotInGroup
    }
}
