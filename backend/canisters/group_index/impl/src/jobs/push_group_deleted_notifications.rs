use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{DeletedGroupInfoInternal, UserId};
use utils::time::MINUTE_IN_MS;

const MAX_BATCH_SIZE: usize = 100;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && state.data.deleted_groups.notifications_pending() > 0 {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'push_group_deleted_notifications' job started");
        true
    } else {
        false
    }
}

fn run() {
    if let Some(batch) = mutate_state(next_batch) {
        if !batch.is_empty() {
            ic_cdk::spawn(push_notifications(batch));
        }
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'push_group_deleted_notifications' job stopped");
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<Vec<(UserId, DeletedGroupInfoInternal)>> {
    if state.data.deleted_groups.notifications_pending() == 0 {
        None
    } else {
        Some(
            (0..MAX_BATCH_SIZE)
                .map_while(|_| state.data.deleted_groups.dequeue_group_deleted_notification())
                .collect(),
        )
    }
}

async fn push_notifications(notifications: Vec<(UserId, DeletedGroupInfoInternal)>) {
    let futures: Vec<_> = notifications.into_iter().map(|(u, d)| push_notification(u, d)).collect();

    futures::future::join_all(futures).await;
}

async fn push_notification(user_id: UserId, deleted_group: DeletedGroupInfoInternal) {
    let args = user_canister::c2c_notify_group_deleted::Args { deleted_group };

    if user_canister_c2c_client::c2c_notify_group_deleted(user_id.into(), &args)
        .await
        .is_err()
    {
        mutate_state(|state| {
            let now = state.env.now();
            let deleted_group = args.deleted_group;

            let retry = now.saturating_sub(deleted_group.timestamp) < 10 * MINUTE_IN_MS;

            state
                .data
                .deleted_groups
                .mark_notification_failed(deleted_group.id, user_id, retry);

            start_job_if_required(state);
        })
    }
}
