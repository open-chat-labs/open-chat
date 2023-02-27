use crate::model::set_user_suspended_queue::{SetUserSuspendedInGroup, SetUserSuspendedType};
use crate::updates::suspend_user::suspend_user_impl;
use crate::updates::unsuspend_user::unsuspend_user_impl;
use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use utils::time::SECOND_IN_MS;

const MAX_BATCH_SIZE: usize = 100;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !runtime_state.data.set_user_suspended_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::default(), run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'set_users_suspended' job started");
        true
    } else {
        false
    }
}

fn run() {
    let batch = mutate_state(next_batch);
    if !batch.is_empty() {
        ic_cdk::spawn(process_batch(batch));
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'set_users_suspended' job stopped");
    }
}

fn next_batch(runtime_state: &mut RuntimeState) -> Vec<SetUserSuspendedType> {
    let now = runtime_state.env.now();

    (0..MAX_BATCH_SIZE)
        .map_while(|_| runtime_state.data.set_user_suspended_queue.take_next_due(now))
        .collect()
}

async fn process_batch(batch: Vec<SetUserSuspendedType>) {
    let futures: Vec<_> = batch.into_iter().map(process_single).collect();

    futures::future::join_all(futures).await;
}

async fn process_single(value: SetUserSuspendedType) {
    match value {
        SetUserSuspendedType::User(details) => {
            suspend_user_impl(details.user_id, details.duration, details.reason, details.suspended_by).await;
        }
        SetUserSuspendedType::Unsuspend(user_id) => {
            unsuspend_user_impl(user_id).await;
        }
        SetUserSuspendedType::Group(SetUserSuspendedInGroup {
            user_id,
            group,
            suspended,
            attempt,
        }) => {
            let args = group_canister::c2c_set_user_suspended::Args { user_id, suspended };
            if group_canister_c2c_client::c2c_set_user_suspended(group.into(), &args)
                .await
                .is_err()
                && attempt < 10
            {
                mutate_state(|state| {
                    let now = state.env.now();
                    state.data.set_user_suspended_queue.schedule(
                        vec![SetUserSuspendedType::Group(SetUserSuspendedInGroup {
                            user_id,
                            group,
                            suspended,
                            attempt: attempt + 1,
                        })],
                        now + (10 * SECOND_IN_MS), // Try again in 10 seconds
                    );
                });
            }
        }
    }
}
