use crate::updates::cancel_user_migration::cancel_migration;
use crate::{RuntimeState, jobs, mutate_state, read_state};
use constants::{HOUR_IN_MS, MINUTE_IN_MS};
use ic_cdk_timers::TimerId;
use std::cell::{Cell, RefCell};
use std::collections::HashSet;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{CanisterId, Hash, Milliseconds, UserId};

// A migration which makes no progress for this long, from being requested to being started, or from
// being started to the user being imported, is cancelled
const STALL_TIMEOUT: Milliseconds = 2 * HOUR_IN_MS;
// The job doesn't run more often than this, so that a stalled migration which fails to be cancelled
// is only tried again after a while
const MIN_INTERVAL: Milliseconds = 10 * MINUTE_IN_MS;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    // The users whose stalled migrations are being cancelled
    static CANCELLING: RefCell<HashSet<UserId>> = RefCell::default();
}

// Cancels the migrations which have stalled, recording them as failed so that they aren't retried
// unless asked for. The job runs when the migration which has gone longest without progress would
// stall, then looks again.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && let Some(earliest_progress) = state.data.user_migrations.earliest_progress()
    {
        let delay = (earliest_progress + STALL_TIMEOUT)
            .saturating_sub(state.env.now())
            .max(MIN_INTERVAL);
        let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(delay), async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'cancel_stalled_user_migrations' job running");
    TIMER_ID.set(None);

    let stalled = read_state(|state| {
        state
            .data
            .user_migrations
            .stalled(state.env.now().saturating_sub(STALL_TIMEOUT))
    });
    for (user_id, multi_user_canister_id, user_hash) in stalled {
        if CANCELLING.with_borrow_mut(|c| c.insert(user_id)) {
            utils::async_work::spawn_tracked(cancel_stalled_migration(user_id, multi_user_canister_id, user_hash));
        }
    }
    read_state(start_job_if_required);
}

async fn cancel_stalled_migration(user_id: UserId, multi_user_canister_id: CanisterId, user_hash: Option<Hash>) {
    let result = cancel_migration(user_id, multi_user_canister_id, user_hash).await;
    CANCELLING.with_borrow_mut(|c| c.remove(&user_id));

    match result {
        Ok(()) => mutate_state(|state| {
            let now = state.env.now();
            if state.data.user_migrations.mark_stalled(user_id, multi_user_canister_id, now) {
                info!(%user_id, %multi_user_canister_id, "Stalled user migration cancelled");
                jobs::start_user_migrations::run(state);
            }
        }),
        // Eg. the user has been imported, in which case the migration carries on
        Err(error) => error!(%user_id, %multi_user_canister_id, ?error, "Failed to cancel stalled user migration"),
    }
}
