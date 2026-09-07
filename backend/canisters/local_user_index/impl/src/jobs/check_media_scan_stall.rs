use crate::{UserIndexEvent, mutate_state};
use constants::{DAY_IN_MS, MINUTE_IN_MS};
use std::time::Duration;
use tracing::warn;
use types::Milliseconds;
use user_index_canister::MediaScanStalled;
use utils::canister_timers::run_now_then_interval;

const CHECK_INTERVAL: Milliseconds = 5 * MINUTE_IN_MS;
// Generous: the worker polls every few seconds, so half an hour of queued-but-unacked jobs
// means it is down, wedged, or unable to reach the matching service. Well inside cap
// headroom - a recovered worker drains the backlog at ~6k jobs/minute.
const STALL_THRESHOLD: Milliseconds = 30 * MINUTE_IN_MS;
const REALERT_AFTER: Milliseconds = DAY_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(CHECK_INTERVAL), run);
}

// Media scan jobs are queued but no verdicts are arriving: the off-chain worker is not
// consuming the log. Raise it in the internal moderation channel (via the user_index) so a
// human investigates - every queued job is potentially unscanned CSAM, and cap overflow
// silently drops the oldest.
fn run() {
    mutate_state(|state| {
        let now = state.env.now();
        if let Some(info) = state
            .data
            .media_scan_job_log
            .check_stalled(STALL_THRESHOLD, REALERT_AFTER, now)
        {
            warn!(info.jobs_pending, info.oldest_job_age, "Media scan pipeline stalled");
            state.push_event_to_user_index(
                UserIndexEvent::MediaScanStalled(Box::new(MediaScanStalled {
                    jobs_pending: info.jobs_pending,
                    oldest_job_age: info.oldest_job_age,
                    latest_job_index: info.latest_job_index,
                })),
                now,
            );
        }
    });
}
