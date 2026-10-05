use crate::model::files_backfill::Stage;
use crate::{RuntimeState, mutate_state, read_state};
use constants::MINUTE_IN_MS;
use std::cell::Cell;
use std::time::Duration;
use storage_bucket_canister::c2c_files::{Args, Response};
use tracing::{error, info};
use types::{CanisterId, FileId, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

const PAGE_SIZE: u32 = 2_000;
// The owners checked against their limits at a time, once every bucket has been paged through. Each
// owner's references are read to work out the bytes they hold.
const OWNERS_PER_BATCH: usize = 100;

thread_local! {
    static RUNNING: Cell<bool> = Cell::default();
}

// Runs the one-off `FilesBackfill`, one page of a bucket's files at a time
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if !RUNNING.get() && state.data.files_backfill.in_progress() {
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
    match read_state(|state| state.data.files_backfill.stage()) {
        Stage::AddingReferences { bucket, after } => match bucket.or_else(|| read_state(|state| bucket_after(None, state))) {
            Some(bucket) => add_references(bucket, after).await,
            None => {
                mutate_state(|state| state.data.files_backfill.set_stage(Stage::RemovingFiles));
                schedule(0);
            }
        },
        Stage::RemovingFiles => remove_files(),
    }
}

async fn add_references(bucket: CanisterId, after: Option<FileId>) {
    let args = Args {
        after,
        max_count: PAGE_SIZE,
    };

    match storage_bucket_canister_c2c_client::c2c_files(bucket, &args).await {
        Ok(Response::Success(result)) => {
            mutate_state(|state| {
                for file in result.files {
                    let owner = file.meta_data.owner;
                    let reference = state.data.add_missing_file_reference(bucket, file);
                    state.data.files_backfill.record(owner, reference);
                }
                let stage = match result.next {
                    Some(after) => Stage::AddingReferences {
                        bucket: Some(bucket),
                        after: Some(after),
                    },
                    None => next_bucket_stage(bucket, state),
                };
                state.data.files_backfill.set_stage(stage);
            });
            schedule(0);
        }
        // Includes a bucket not yet upgraded to have `c2c_files`, which will be once it is
        Err(error) => match delay_if_should_retry_failed_c2c_call_to_new_method(&error) {
            Some(delay) => {
                if !error.is_method_not_found() {
                    error!(%bucket, ?error, "Failed to get the bucket's files, retrying");
                }
                schedule(delay);
            }
            None => {
                error!(%bucket, ?error, "Failed to get the bucket's files, skipping the rest of them");
                mutate_state(|state| {
                    let stage = next_bucket_stage(bucket, state);
                    state.data.files_backfill.skip_bucket(bucket);
                    state.data.files_backfill.set_stage(stage);
                });
                schedule(0);
            }
        },
    }
}

fn remove_files() {
    // The references the reconciliation removes still count towards their owners' bytes used,
    // which decides who is over their limit, so it must have completed first
    if read_state(|state| state.data.files_reconciliation.in_progress()) {
        schedule(MINUTE_IN_MS);
        return;
    }

    let completed = mutate_state(|state| {
        for (user_id, charged) in state.data.files_backfill.take_charged(OWNERS_PER_BATCH) {
            if let Some((count, bytes)) = state.data.remove_oldest_files_over_limit(user_id, charged) {
                state.data.files_backfill.record_over_limit(count, bytes);
            }
        }
        if state.data.files_backfill.is_complete_after_removing_files() {
            let now = state.env.now();
            state.data.files_backfill.complete(now);
            true
        } else {
            false
        }
    });

    if completed {
        RUNNING.set(false);
        info!("Files backfill completed");
    } else {
        schedule(0);
    }
}

fn next_bucket_stage(bucket: CanisterId, state: &RuntimeState) -> Stage {
    match bucket_after(Some(bucket), state) {
        Some(next) => Stage::AddingReferences {
            bucket: Some(next),
            after: None,
        },
        None => Stage::RemovingFiles,
    }
}

// The bucket with the lowest canister id after `bucket`, or the lowest of all if it is `None`
fn bucket_after(bucket: Option<CanisterId>, state: &RuntimeState) -> Option<CanisterId> {
    state
        .data
        .buckets
        .iter()
        .map(|b| b.canister_id)
        .filter(|c| bucket.is_none_or(|b| *c > b))
        .min()
}
