use crate::canister::convert_cdk_error;
use candid::Principal;
use ic_cdk::call::{Call, CallResult, RejectCode};
use ic_cdk::management_canister::{self, ClearChunkStoreArgs, UploadChunkArgs};
use ic_management_canister_types::UploadChunkResult;
use types::{CanisterId, Hash};

const ONE_MB: usize = 1024 * 1024;

pub async fn upload_wasm_in_chunks(wasm: &[u8], store_canister_id: CanisterId) -> Result<Vec<Hash>, (RejectCode, String)> {
    futures::future::try_join_all(
        wasm.chunks(ONE_MB)
            .into_iter()
            .map(|chunk| upload_chunk_and_return_hash(store_canister_id, chunk.to_vec())),
    )
    .await
}

pub async fn upload_chunk(arg: &UploadChunkArgs) -> CallResult<UploadChunkResult> {
    Ok(Call::unbounded_wait(Principal::management_canister(), "upload_chunk")
        .with_arg(arg)
        .await?
        .candid()?)
}

pub async fn clear_chunk_store(store_canister_id: CanisterId) -> Result<(), (RejectCode, String)> {
    management_canister::clear_chunk_store(&ClearChunkStoreArgs {
        canister_id: store_canister_id,
    })
    .await
    .map_err(convert_cdk_error)
}

async fn upload_chunk_and_return_hash(store_canister_id: CanisterId, chunk: Vec<u8>) -> Result<Hash, (RejectCode, String)> {
    upload_chunk(&UploadChunkArgs {
        canister_id: store_canister_id,
        chunk,
    })
    .await
    .map(|r| r.hash.try_into().unwrap())
    .map_err(convert_cdk_error)
}
