use ic_cdk::api::call::CallResult;
use std::cell::RefCell;
use std::collections::HashMap;
use types::{BlobReference, CanisterId};

thread_local! {
    static PENDING_RETRY: RefCell<Vec<BlobReference>> = RefCell::default();
}

pub fn retry_failed() {
    let references = PENDING_RETRY.with(|r| r.take());
    if !references.is_empty() {
        ic_cdk::spawn(delete_files(references));
    }
}

pub async fn delete_files(blob_references: Vec<BlobReference>) {
    async fn delete_files_inner(
        canister_id: CanisterId,
        blob_ids: Vec<u128>,
    ) -> CallResult<storage_bucket_canister::delete_files::Response> {
        let args = storage_bucket_canister::delete_files::Args {
            file_ids: blob_ids.clone(),
        };

        let response = storage_bucket_canister_c2c_client::delete_files(canister_id, &args).await;
        if let Err((_, message)) = &response {
            // If the bucket canister was stopped, mark that the deletion should be retried later.
            if message.to_uppercase().contains("STOPPED") {
                let references: Vec<_> = blob_ids
                    .into_iter()
                    .map(|blob_id| BlobReference { canister_id, blob_id })
                    .collect();

                PENDING_RETRY.with(|r| r.borrow_mut().extend(references));
            }
        }
        response
    }

    let mut grouped: HashMap<CanisterId, Vec<u128>> = HashMap::new();
    for br in blob_references {
        grouped.entry(br.canister_id).or_default().push(br.blob_id);
    }

    let futures: Vec<_> = grouped
        .into_iter()
        .map(|(canister_id, blob_ids)| delete_files_inner(canister_id, blob_ids))
        .collect();

    futures::future::join_all(futures).await;
}
