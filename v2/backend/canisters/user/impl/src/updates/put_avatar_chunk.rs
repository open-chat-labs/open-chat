use crate::updates::put_avatar_chunk::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use user_canister::put_chunk::*;
use utils::blob_storage::PutChunkResult;

#[update]
fn put_avatar_chunk(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| put_avatar_chunk_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn put_avatar_chunk_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

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
        PutChunkResult::Complete => {
            if let Some(existing_avatar_reference) = runtime_state.data.avatar_blob_reference {
                runtime_state.data.blob_storage.delete_blob(&existing_avatar_reference);
            }
            runtime_state.data.avatar_blob_reference = Some(args.blob_id);
            Success
        }
        PutChunkResult::BlobAlreadyExists => BlobAlreadyExists,
        PutChunkResult::ChunkAlreadyExists => ChunkAlreadyExists,
        PutChunkResult::ChunkTooBig => ChunkTooBig,
        PutChunkResult::Full => Full,
    }
}
