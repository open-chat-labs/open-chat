use ic_cdk::api::call::CallResult;
use std::cell::RefCell;
use std::collections::HashMap;
use types::CanisterId;

thread_local! {
    static PENDING_RETRY: RefCell<Vec<(CanisterId, u128)>> = RefCell::default();
}

pub fn retry_failed() {
    let references = PENDING_RETRY.with(|r| r.take());
    if !references.is_empty() {
        ic_cdk::spawn(delete_files(references));
    }
}

pub async fn delete_files(file_references: Vec<(CanisterId, u128)>) {
    async fn delete_files_inner(
        canister_id: CanisterId,
        file_ids: Vec<u128>,
    ) -> CallResult<open_storage_bucket_canister::delete_files::Response> {
        let args = open_storage_bucket_canister::delete_files::Args {
            file_ids: file_ids.clone(),
        };

        let response = open_storage_bucket_canister_c2c_client::delete_files(canister_id, &args).await;
        if let Err((_, message)) = &response {
            // If the bucket canister was stopped, mark that the deletion should be retried later.
            if message.to_uppercase().contains("STOPPED") {
                let references: Vec<_> = file_ids.into_iter().map(|file_id| (canister_id, file_id)).collect();

                PENDING_RETRY.with(|r| r.borrow_mut().extend(references));
            }
        }
        response
    }

    let mut grouped: HashMap<CanisterId, Vec<u128>> = HashMap::new();
    for (canister_id, file_id) in file_references {
        grouped.entry(canister_id).or_default().push(file_id);
    }

    let futures: Vec<_> = grouped
        .into_iter()
        .map(|(canister_id, file_ids)| delete_files_inner(canister_id, file_ids))
        .collect();

    futures::future::join_all(futures).await;
}
