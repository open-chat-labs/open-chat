use crate::updates::put_avatar_chunk::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use types::CanisterId;
use user_canister::put_chunk::*;
use user_index_canister::c2c_set_avatar;
use utils::blob_storage::PutChunkResult;

const MAX_AVATAR_CHUNK_COUNT: u32 = 2;

#[update]
fn put_avatar_chunk(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| put_avatar_chunk_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn put_avatar_chunk_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let now = runtime_state.env.now();

    if args.total_chunks > MAX_AVATAR_CHUNK_COUNT {
        return BlobTooBig;
    }

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
            if let Some(avatar_blob_id) = runtime_state.data.avatar_blob_id {
                runtime_state.data.blob_storage.delete_blob(&avatar_blob_id);
            }
            runtime_state.data.avatar_blob_id = Some(args.blob_id);
            ic_cdk::block_on(call_set_avatar_on_user_index(
                runtime_state.data.user_index_canister_id,
                runtime_state.data.avatar_blob_id,
            ));
            Success
        }
        PutChunkResult::BlobAlreadyExists => BlobAlreadyExists,
        PutChunkResult::ChunkAlreadyExists => ChunkAlreadyExists,
        PutChunkResult::ChunkTooBig => ChunkTooBig,
        PutChunkResult::Full => Full,
    }
}

async fn call_set_avatar_on_user_index(user_index_canister_id: CanisterId, avatar_blob_id: Option<u128>) {
    let args = c2c_set_avatar::Args { avatar_blob_id };

    let _ = user_index_canister_c2c_client::c2c_set_avatar(user_index_canister_id, &args).await;
}
