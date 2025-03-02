use crate::{mutate_state, read_state, RuntimeState};
use constants::MINUTE_IN_MS;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{DeletedCommunityInfo, UserId};

const MAX_BATCH_SIZE: usize = 100;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.deleted_communities.notifications_pending() > 0 {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'push_community_deleted_notifications' job running");
    TIMER_ID.set(None);

    if let Some(batch) = mutate_state(next_batch) {
        if !batch.is_empty() {
            ic_cdk::futures::spawn(push_notifications(batch));
            read_state(start_job_if_required);
        }
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<(UserId, DeletedCommunityInfo)>> {
    if state.data.deleted_communities.notifications_pending() == 0 {
        None
    } else {
        Some(
            (0..MAX_BATCH_SIZE)
                .map_while(|_| state.data.deleted_communities.dequeue_community_deleted_notification())
                .collect(),
        )
    }
}

async fn push_notifications(notifications: Vec<(UserId, DeletedCommunityInfo)>) {
    let futures: Vec<_> = notifications.into_iter().map(|(u, d)| push_notification(u, d)).collect();

    futures::future::join_all(futures).await;

    read_state(start_job_if_required);
}

async fn push_notification(user_id: UserId, deleted_community: DeletedCommunityInfo) {
    let args = user_canister::c2c_notify_community_deleted::Args { deleted_community };

    if user_canister_c2c_client::c2c_notify_community_deleted(user_id.into(), &args)
        .await
        .is_err()
    {
        mutate_state(|state| {
            let now = state.env.now();
            let deleted_community = args.deleted_community;

            let retry = now.saturating_sub(deleted_community.timestamp) < 10 * MINUTE_IN_MS;

            state
                .data
                .deleted_communities
                .mark_notification_failed(deleted_community.id, user_id, retry);

            start_job_if_required(state);
        });
    }
}
