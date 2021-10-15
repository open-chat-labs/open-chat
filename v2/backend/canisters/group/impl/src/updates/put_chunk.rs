use crate::updates::put_chunk::Response::*;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use group_canister::put_chunk::*;
use ic_cdk_macros::update;
use tracing::instrument;
use utils::blob_storage::PutChunkResult;

#[update]
#[instrument(level = "trace")]
fn put_chunk(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| put_chunk_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn put_chunk_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_participant() {
        let now = runtime_state.env.now();

        match runtime_state.data.blob_storage.put_chunk(
            args.blob_id,
            args.mime_type,
            args.total_chunks,
            args.index,
            args.bytes,
            now,
        ) {
            PutChunkResult::Success => Success,
            PutChunkResult::Complete => Success,
            PutChunkResult::BlobAlreadyExists => BlobAlreadyExists,
            PutChunkResult::ChunkAlreadyExists => ChunkAlreadyExists,
            PutChunkResult::ChunkTooBig => ChunkTooBig,
            PutChunkResult::Full => Full,
        }
    } else {
        CallerNotInGroup
    }
}
