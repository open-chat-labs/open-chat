use crate::{RuntimeState, mutate_state, read_state};
use std::cell::Cell;
use std::collections::{BTreeMap, HashSet};
use std::time::Duration;
use storage_bucket_canister::c2c_missing_files::{Args, Response};
use tracing::{error, info};
use types::{CanisterId, FileId, Milliseconds};
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

    let mut file_ids_by_bucket: BTreeMap<CanisterId, Vec<FileId>> = BTreeMap::new();
    for (file, bucket) in page.iter() {
        file_ids_by_bucket.entry(*bucket).or_default().push(file.file_id);
    }

    let responses = futures::future::join_all(file_ids_by_bucket.into_iter().map(|(bucket, file_ids)| async move {
        let response = storage_bucket_canister_c2c_client::c2c_missing_files(bucket, &Args { file_ids }).await;
        (bucket, response)
    }))
    .await;

    let mut missing = HashSet::new();
    let mut buckets_skipped = HashSet::new();
    let mut retry_after = None;
    for (bucket, response) in responses {
        match response {
            Ok(Response::Success(result)) => missing.extend(result.missing.into_iter().map(|file_id| (bucket, file_id))),
            // Includes a bucket not yet upgraded to have `c2c_missing_files`, which will be once it is
            Err(error) => match delay_if_should_retry_failed_c2c_call_to_new_method(&error) {
                Some(delay) => retry_after = Some(retry_after.map_or(delay, |d: Milliseconds| d.max(delay))),
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
        let checked = page.len() as u64;
        let mut removed = 0;
        let mut skipped = 0;
        for (file, bucket) in page {
            if buckets_skipped.contains(&bucket) {
                skipped += 1;
            } else if missing.contains(&(bucket, file.file_id)) {
                state.data.remove_file_reference(bucket, file);
                removed += 1;
            }
        }
        state
            .data
            .files_reconciliation
            .record_page(last_checked, checked, removed, skipped);
    });

    schedule(0);
}
