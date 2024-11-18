use std::collections::HashMap;
use types::{BlobReference, CanisterId};
use utils::canister::should_retry_failed_c2c_call;

pub async fn delete_files(blob_references: Vec<BlobReference>) -> Vec<BlobReference> {
    async fn delete_files_inner(canister_id: CanisterId, blob_ids: Vec<u128>) -> Result<(), Vec<BlobReference>> {
        let args = storage_bucket_canister::delete_files::Args {
            file_ids: blob_ids.clone(),
        };

        match storage_bucket_canister_c2c_client::delete_files(canister_id, &args).await {
            Ok(_) => Ok(()),
            Err((code, message)) if should_retry_failed_c2c_call(code, &message) => Err(blob_ids
                .into_iter()
                .map(|blob_id| BlobReference { canister_id, blob_id })
                .collect()),
            Err(_) => Err(Vec::new()),
        }
    }

    let mut grouped: HashMap<CanisterId, Vec<u128>> = HashMap::new();
    for br in blob_references {
        grouped.entry(br.canister_id).or_default().push(br.blob_id);
    }

    let futures: Vec<_> = grouped
        .into_iter()
        .map(|(canister_id, blob_ids)| delete_files_inner(canister_id, blob_ids))
        .collect();

    let results = futures::future::join_all(futures).await;
    results
        .into_iter()
        .flat_map(|res| if let Err(brs) = res { brs } else { Vec::new() })
        .collect()
}
