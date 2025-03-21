use crate::canister::convert_cdk_error;
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::{self, ClearChunkStoreArgs, UploadChunkArgs};
use types::{CanisterId, Hash};

const ONE_MB: usize = 1024 * 1024;

pub async fn upload_wasm_in_chunks(wasm: &[u8], store_canister_id: CanisterId) -> Result<Vec<Hash>, (RejectCode, String)> {
    let mut chunks = Vec::new();
    for chunk in wasm.chunks(ONE_MB) {
        let chunk_hash = management_canister::upload_chunk(&UploadChunkArgs {
            canister_id: store_canister_id,
            chunk: chunk.to_vec(),
        })
        .await
        .map_err(convert_cdk_error)?;

        chunks.push(chunk_hash.hash.try_into().unwrap());
    }
    Ok(chunks)
}

pub async fn clear_chunk_store(store_canister_id: CanisterId) -> Result<(), (RejectCode, String)> {
    management_canister::clear_chunk_store(&ClearChunkStoreArgs {
        canister_id: store_canister_id,
    })
    .await
    .map_err(convert_cdk_error)
}
