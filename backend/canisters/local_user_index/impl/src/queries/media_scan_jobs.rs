use crate::guards::caller_is_media_scanner;
use crate::{RuntimeState, read_state};
use ic_cdk::query;
use local_user_index_canister::media_scan_jobs::{Response::*, *};

// Jobs are small (blob references + ids, no media bytes), so the batch is bounded by count
// rather than approximate size
const MAX_JOBS_PER_BATCH: usize = 500;

#[query(guard = "caller_is_media_scanner")]
fn media_scan_jobs(args: Args) -> Response {
    read_state(|state| media_scan_jobs_impl(args, state))
}

fn media_scan_jobs_impl(args: Args, state: &RuntimeState) -> Response {
    let jobs = state
        .data
        .media_scan_job_log
        .iter(args.from_job_index)
        .take(MAX_JOBS_PER_BATCH)
        .cloned()
        .collect();

    Success(SuccessResult {
        jobs,
        latest_job_index: state.data.media_scan_job_log.latest_job_index(),
        timestamp: state.env.now(),
    })
}
