use crate::guards::caller_is_media_scanner;
use crate::{CommunityEvent, GroupEvent, RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use local_user_index_canister::submit_media_scan_verdicts::{Response::*, *};
use tracing::info;
use types::{MediaScanBlobOutcome, MediaScanMatched, MediaScanVerdict};

#[update(guard = "caller_is_media_scanner")]
#[trace]
fn submit_media_scan_verdicts(args: Args) -> Response {
    mutate_state(|state| submit_media_scan_verdicts_impl(args, state))
}

fn submit_media_scan_verdicts_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    for verdict in args.verdicts {
        route_matches(verdict, now, state);
    }
    // Pruned after routing: routing needs the job entries to resolve each verdict's source
    state.data.media_scan_job_log.prune(args.up_to_job_index);
    Success
}

fn route_matches(verdict: MediaScanVerdict, now: u64, state: &mut RuntimeState) {
    let matches: Vec<_> = verdict
        .outcomes
        .into_iter()
        .filter_map(
            |outcome| {
                if let MediaScanBlobOutcome::Match(m) = outcome { Some(m) } else { None }
            },
        )
        .collect();
    if matches.is_empty() {
        return;
    }

    // A verdict for an already-pruned job (a duplicate submission) is dropped here; the
    // escalation it would trigger already ran, and it is idempotent downstream regardless
    let Some(job) = state.data.media_scan_job_log.get(verdict.job_index) else {
        info!(verdict.job_index, "Media scan verdict for unknown job, ignoring");
        return;
    };
    if job.request.message_id != verdict.message_id {
        info!(verdict.job_index, "Media scan verdict message id mismatch, ignoring");
        return;
    }

    let result = MediaScanMatched {
        channel_id: job.request.channel_id,
        thread_root_message_index: job.request.thread_root_message_index,
        message_id: job.request.message_id,
        matches,
    };
    let source = job.source;
    if job.is_group {
        state.push_event_to_group(source, GroupEvent::MediaScanMatched(result), now);
    } else {
        state.push_event_to_community(source, CommunityEvent::MediaScanMatched(result), now);
    }
}
