use crate::{RuntimeState, mutate_state, read_state};
use constants::MINUTE_IN_MS;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{CanisterId, UserId, UserType};

// One-off job which fetches the last online date of every user from the OnlineUsers canister.
// TODO remove once the users have been migrated

const BATCH_SIZE: usize = 500;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    start_job_if_required_with_delay(state, Duration::ZERO)
}

fn start_job_if_required_with_delay(state: &RuntimeState, delay: Duration) -> bool {
    if TIMER_ID.get().is_none() && !state.data.users_last_online.is_complete() {
        let timer_id = ic_cdk_timers::set_timer(delay, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'fetch_users_last_online' job running");
    TIMER_ID.set(None);

    let (canister_id, batch) = mutate_state(|state| {
        state.data.users_last_online.start_if_required(
            state
                .data
                .users
                .iter()
                .filter(|u| u.user_type == UserType::User)
                .map(|u| u.user_id),
        );

        (
            state.data.online_users_canister_id,
            state.data.users_last_online.take_next_batch(BATCH_SIZE),
        )
    });

    if !batch.is_empty() {
        utils::async_work::spawn_tracked(fetch_batch(canister_id, batch));
    } else {
        read_state(log_completed);
    }
}

async fn fetch_batch(canister_id: CanisterId, user_ids: Vec<UserId>) {
    let args = online_users_canister::last_online::Args {
        user_ids: user_ids.clone(),
    };

    match online_users_canister_c2c_client::last_online(canister_id, &args).await {
        Ok(online_users_canister::last_online::Response::Success(results)) => mutate_state(|state| {
            let now = state.env.now();
            state.data.users_last_online.record_batch(
                user_ids,
                results
                    .into_iter()
                    .map(|r| (r.user_id, now.saturating_sub(r.duration_since_last_online))),
            );
            if state.data.users_last_online.is_complete() {
                log_completed(state);
            } else {
                start_job_if_required(state);
            }
        }),
        Err(error) => {
            error!(?error, "Failed to fetch users' last online dates");
            mutate_state(|state| {
                state.data.users_last_online.return_batch(user_ids);
                start_job_if_required_with_delay(state, Duration::from_millis(MINUTE_IN_MS));
            });
        }
    }
}

fn log_completed(state: &RuntimeState) {
    info!(metrics = ?state.data.users_last_online.metrics(), "Fetched users' last online dates");
}
