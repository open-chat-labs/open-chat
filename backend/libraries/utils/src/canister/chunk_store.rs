use ic_cdk::api::call::CallResult;
use ic_cdk::api::management_canister::main::{ClearChunkStoreArgument, UploadChunkArgument};
use types::{CanisterId, Hash};

const ONE_MB: usize = 1024 * 1024;

pub async fn upload_wasm_in_chunks(wasm: &[u8], store_canister_id: CanisterId) -> CallResult<Vec<Hash>> {
    let mut chunks = Vec::new();
    for chunk in wasm.chunks(ONE_MB) {
        let (chunk_hash,) = ic_cdk::api::management_canister::main::upload_chunk(UploadChunkArgument {
            canister_id: store_canister_id,
            chunk: chunk.to_vec(),
        })
        .await?;

        chunks.push(chunk_hash.hash.try_into().unwrap());
    }
    Ok(chunks)
}

pub async fn clear_chunk_store(store_canister_id: CanisterId) -> CallResult<()> {
    ic_cdk::api::management_canister::main::clear_chunk_store(ClearChunkStoreArgument {
        canister_id: store_canister_id,
    })
    .await
}
