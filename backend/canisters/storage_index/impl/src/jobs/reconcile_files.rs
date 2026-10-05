use crate::model::files_reconciliation::PageResult;
use crate::{RuntimeState, mutate_state, read_state};
use std::cell::Cell;
use std::collections::{BTreeMap, HashSet};
use std::time::Duration;
use storage_bucket_canister::c2c_missing_files::{Args, FileReference, Response};
use tracing::{error, info};
use types::{CanisterId, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

// Pages hold the references to several buckets' files, each of which is asked about its own
const PAGE_SIZE: usize = 2_000;

thread_local! {
    static RUNNING: Cell<bool> = Cell::default();
}

// Runs the one-off `FilesReconciliation`, one page of file references at a time
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if !RUNNING.get() && state.data.files_reconciliation.in_progress() {
        RUNNING.set(true);
        schedule(0);
        true
    } else {
        false
    }
}

fn schedule(delay: Milliseconds) {
    ic_cdk_timers::set_timer(Duration::from_millis(delay), async {
        utils::async_work::spawn_tracked(run());
    });
}

async fn run() {
    let page = read_state(|state| {
        state
            .data
            .files
            .file_references_after(state.data.files_reconciliation.last_checked(), PAGE_SIZE)
    });

    let Some((last_checked, _)) = page.last().cloned() else {
        mutate_state(|state| {
            let now = state.env.now();
            state.data.files_reconciliation.complete(now);
        });
        RUNNING.set(false);
        info!("Files reconciliation completed");
        return;
    };

    let mut files_by_bucket: BTreeMap<CanisterId, Vec<FileReference>> = BTreeMap::new();
    for (file, bucket) in page.iter() {
        files_by_bucket.entry(*bucket).or_default().push(FileReference {
            file_id: file.file_id,
            owner: file.meta_data.owner,
            created: file.meta_data.created,
        });
    }

    let responses = futures::future::join_all(files_by_bucket.into_iter().map(|(bucket, files)| async move {
        let response = storage_bucket_canister_c2c_client::c2c_missing_files(bucket, &Args { files }).await;
        (bucket, response)
    }))
    .await;

    let mut missing = HashSet::new();
    let mut mismatched = HashSet::new();
    let mut buckets_skipped = HashSet::new();
    let mut retry_after = None;
    for (bucket, response) in responses {
        match response {
            Ok(Response::Success(result)) => {
                missing.extend(result.missing.into_iter().map(|file_id| (bucket, file_id)));
                mismatched.extend(result.mismatched.into_iter().map(|f| (bucket, f.file_id, f.owner, f.created)));
            }
            // Includes a bucket not yet upgraded to have `c2c_missing_files`, which will be once it is
            Err(error) => match delay_if_should_retry_failed_c2c_call_to_new_method(&error) {
                Some(delay) => {
                    if !error.is_method_not_found() {
                        error!(%bucket, ?error, "Failed to check which files the bucket is missing, retrying");
                    }
                    retry_after = Some(retry_after.map_or(delay, |d: Milliseconds| d.max(delay)));
                }
                None => {
                    error!(%bucket, ?error, "Failed to check which files the bucket is missing");
                    buckets_skipped.insert(bucket);
                }
            },
        }
    }

    // Every bucket is asked about the page before the job moves on past it
    if let Some(delay) = retry_after {
        schedule(delay);
        return;
    }

    mutate_state(|state| {
        let mut result = PageResult::default();
        for (file, bucket) in page {
            if buckets_skipped.contains(&bucket) {
                result.skipped += 1;
                continue;
            }
            result.checked += 1;
            if missing.contains(&(bucket, file.file_id)) {
                state.data.remove_file_reference(bucket, file);
                result.missing += 1;
            } else if mismatched.contains(&(bucket, file.file_id, file.meta_data.owner, file.meta_data.created)) {
                state.data.remove_file_reference(bucket, file);
                result.mismatched += 1;
            }
        }
        state.data.files_reconciliation.record_page(last_checked, result);
    });

    schedule(0);
}
