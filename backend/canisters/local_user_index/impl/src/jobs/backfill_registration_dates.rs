// Fills in the registration date of each user this LocalUserIndex holds without one, which is
// every user it held before dates were recorded. Starts on every upgrade while any are left, so a
// user registered while the UserIndex didn't yet send dates is filled in by the next upgrade.
use crate::{RuntimeState, mutate_state, read_state};
use constants::MINUTE_IN_MS;
use ic_cdk_timers::TimerId;
use std::cell::{Cell, RefCell};
use std::time::Duration;
use tracing::{info, trace};
use types::{Milliseconds, UserId};

const BATCH_SIZE: usize = 5_000;
const MAX_ATTEMPTS: u32 = 60;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    // The users still to ask for, taken once when the job starts so users the UserIndex has no date
    // for (it has none for bots) are asked for once per upgrade rather than forever
    static QUEUE: RefCell<Vec<UserId>> = RefCell::default();
    static FAILED_ATTEMPTS: Cell<u32> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() {
        let undated = state.data.global_users.undated_user_ids();
        if !undated.is_empty() {
            info!(count = undated.len(), "Backfilling registration dates");
            QUEUE.set(undated);
            schedule(0);
            return true;
        }
    }
    false
}

fn schedule(delay: Milliseconds) {
    let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(delay), run());
    TIMER_ID.set(Some(timer_id));
}

async fn run() {
    trace!("'backfill_registration_dates' running");
    TIMER_ID.set(None);

    let batch: Vec<UserId> = QUEUE.with_borrow(|q| q.iter().rev().take(BATCH_SIZE).copied().collect());
    if batch.is_empty() {
        return;
    }

    let user_index_canister_id = read_state(|state| state.data.user_index_canister_id);
    let args = user_index_canister::c2c_registration_dates::Args { user_ids: batch.clone() };

    match user_index_canister_c2c_client::c2c_registration_dates(user_index_canister_id, &args).await {
        Ok(user_index_canister::c2c_registration_dates::Response::Success(dates)) => {
            mutate_state(|state| state.data.global_users.set_registration_dates(dates));
            QUEUE.with_borrow_mut(|q| q.truncate(q.len() - batch.len()));
            FAILED_ATTEMPTS.set(0);
            if QUEUE.with_borrow(|q| !q.is_empty()) {
                schedule(0);
            } else {
                info!("Registration dates backfilled");
            }
        }
        Err(error) => {
            // An older UserIndex without the endpoint fails every call, so give up after a while.
            // The next upgrade starts again.
            let attempts = FAILED_ATTEMPTS.get() + 1;
            FAILED_ATTEMPTS.set(attempts);
            if attempts < MAX_ATTEMPTS {
                schedule(MINUTE_IN_MS);
            } else {
                info!(?error, "Gave up backfilling registration dates");
            }
        }
    }
}
