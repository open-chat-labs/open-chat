use crate::jobs::latest_id_if_migrated;
use crate::{RuntimeState, mutate_state, read_state};
use constants::MINUTE_IN_MS;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{DeletedGroupInfoInternal, UserId};

const MAX_BATCH_SIZE: usize = 100;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.deleted_groups.notifications_pending() > 0 {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'push_group_deleted_notifications' job running");
    TIMER_ID.set(None);

    if let Some(batch) = mutate_state(next_batch)
        && !batch.is_empty()
    {
        utils::async_work::spawn_tracked(push_notifications(batch));
        read_state(start_job_if_required);
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
    // Sent to the user's latest id if they are known to have been migrated since having `user_id`
    let user_id = read_state(|state| state.data.migrated_user_ids.latest(user_id));
    let args = user_canister::c2c_notify_group_deleted::Args { user_id, deleted_group };

    if let Err(error) = user_canister_c2c_client::c2c_notify_group_deleted(user_id.canister_id(), &args).await {
        // If the user has been migrated to a MultiUser canister, the notification is sent on to them
        // there instead
        let new_user_id = latest_id_if_migrated(user_id, &error).await;

        mutate_state(|state| {
            let deleted_group = args.deleted_group;

            if let Some(new_user_id) = new_user_id {
                state.data.migrated_user_ids.insert(user_id, new_user_id);
                state
                    .data
                    .deleted_groups
                    .mark_notification_failed(deleted_group.id, new_user_id, true);
            } else {
                let now = state.env.now();
                let retry = now.saturating_sub(deleted_group.timestamp) < 10 * MINUTE_IN_MS;

                state
                    .data
                    .deleted_groups
                    .mark_notification_failed(deleted_group.id, user_id, retry);
            }

            start_job_if_required(state);
        });
    }
}
