use crate::Data;
use crate::timer_job_types::{MarkP2PSwapExpiredJob, TimerJob};
use chat_events::Reader;
use constants::P2P_SWAP_MAX_EXPIRY;
use types::{P2PSwapStatus, TimestampMillis};

// One-off, now that no P2P swap stays open for longer than `P2P_SWAP_MAX_EXPIRY` (the Escrow
// canister cancelled those set to): cancels each job to mark a swap in one of the user's direct
// chats as expired if the swap has ended, and otherwise has it run no later than that long after
// the swap was offered, running it now if that time has passed. Hundreds of swaps were offered
// with expiries decades away, and these jobs hold up migrating the user to a MultiUser canister.
// Returns how many jobs were cancelled, run and brought forward.
// TODO remove after the release containing this has been deployed
pub(crate) fn cap_p2p_swap_expiry_jobs(data: &mut Data, now: TimestampMillis) -> (usize, usize, usize) {
    let jobs: Vec<(TimestampMillis, MarkP2PSwapExpiredJob)> = data
        .timer_jobs
        .iter()
        .filter_map(|(due, wrapper)| match wrapper.borrow().as_ref() {
            Some(TimerJob::MarkP2PSwapExpired(job)) => Some((*due, (**job).clone())),
            _ => None,
        })
        .collect();

    let (mut cancelled, mut run, mut brought_forward) = (0, 0, 0);
    for (due, job) in jobs {
        let chat_id = data
            .user
            .direct_chats
            .latest_user_id(job.chat_id.into(), &data.migrated_user_ids)
            .into();
        // When the swap was offered, if it is still open
        let offered_at = data.user.direct_chats.get(&chat_id).and_then(|chat| {
            let swap = chat.get_p2p_swap(job.thread_root_message_index, job.message_id)?;
            if !matches!(swap.status, P2PSwapStatus::Open) {
                return None;
            }
            chat.events_reader(job.thread_root_message_index)?
                .message_event_internal(job.message_id.into())
                .map(|event| event.timestamp)
        });

        let action = action(due, offered_at, now);
        if action == Action::Keep {
            continue;
        }
        data.timer_jobs.cancel_job(|j| {
            matches!(j, TimerJob::MarkP2PSwapExpired(j)
                if j.chat_id == job.chat_id
                    && j.thread_root_message_index == job.thread_root_message_index
                    && j.message_id == job.message_id)
        });
        match action {
            Action::Keep => {}
            Action::Cancel => cancelled += 1,
            Action::RunNow => {
                if let Some(mut chat) = data.user.direct_chats.get_mut(&chat_id) {
                    let _ = chat.mark_p2p_swap_expired(job.thread_root_message_index, job.message_id, now);
                }
                run += 1;
            }
            Action::BringForward(to) => {
                data.timer_jobs
                    .enqueue_job(TimerJob::MarkP2PSwapExpired(Box::new(job)), to, now);
                brought_forward += 1;
            }
        }
    }
    (cancelled, run, brought_forward)
}

#[derive(Debug, PartialEq, Eq)]
enum Action {
    Keep,
    Cancel,
    RunNow,
    BringForward(TimestampMillis),
}

// `offered_at` is when the swap was offered, or `None` if it has ended (or can't be found)
fn action(due: TimestampMillis, offered_at: Option<TimestampMillis>, now: TimestampMillis) -> Action {
    let Some(offered_at) = offered_at else {
        return Action::Cancel;
    };
    let latest = offered_at + P2P_SWAP_MAX_EXPIRY;
    if due <= latest {
        Action::Keep
    } else if latest <= now {
        Action::RunNow
    } else {
        Action::BringForward(latest)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use constants::DAY_IN_MS;

    const NOW: TimestampMillis = 1_000 * DAY_IN_MS;

    #[test]
    fn job_for_an_ended_swap_is_cancelled() {
        assert_eq!(action(NOW + 10_000 * DAY_IN_MS, None, NOW), Action::Cancel);
    }

    #[test]
    fn job_for_an_open_swap_offered_over_the_maximum_ago_is_run_now() {
        assert_eq!(
            action(NOW + 10_000 * DAY_IN_MS, Some(NOW - 600 * DAY_IN_MS), NOW),
            Action::RunNow
        );
    }

    #[test]
    fn job_for_a_recent_open_swap_due_beyond_the_maximum_is_brought_forward() {
        let offered_at = NOW - DAY_IN_MS;
        assert_eq!(
            action(NOW + 365 * DAY_IN_MS, Some(offered_at), NOW),
            Action::BringForward(offered_at + P2P_SWAP_MAX_EXPIRY)
        );
    }

    #[test]
    fn job_due_within_the_maximum_is_kept() {
        let offered_at = NOW - DAY_IN_MS;
        assert_eq!(action(offered_at + 7 * DAY_IN_MS, Some(offered_at), NOW), Action::Keep);
        assert_eq!(action(offered_at + P2P_SWAP_MAX_EXPIRY, Some(offered_at), NOW), Action::Keep);
    }
}
