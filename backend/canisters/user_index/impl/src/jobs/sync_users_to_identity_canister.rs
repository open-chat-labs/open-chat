use crate::{mutate_state, RuntimeState};
use candid::Principal;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::cmp::min;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, UserId};

const BATCH_SIZE: usize = 100;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.identity_canister_user_sync_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub(crate) fn try_run_now(state: &mut RuntimeState) -> bool {
    if let Some((canister_id, users)) = next_batch(state) {
        if let Some(timer_id) = TIMER_ID.take() {
            ic_cdk_timers::clear_timer(timer_id);
        }
        ic_cdk::futures::spawn(sync_users(canister_id, users));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'sync_users_to_identity_canister' job running");
    TIMER_ID.set(None);

    if let Some((canister_id, users)) = mutate_state(next_batch) {
        ic_cdk::futures::spawn(sync_users(canister_id, users));
    }
}

#[allow(clippy::type_complexity)]
fn next_batch(state: &mut RuntimeState) -> Option<(CanisterId, Vec<(Principal, Option<UserId>)>)> {
    let count = min(state.data.identity_canister_user_sync_queue.len(), BATCH_SIZE);
    if count == 0 {
        return None;
    }

    let batch: Vec<_> = state.data.identity_canister_user_sync_queue.drain(..count).collect();

    Some((state.data.identity_canister_id, batch))
}

async fn sync_users(identity_canister_id: CanisterId, users: Vec<(Principal, Option<UserId>)>) {
    let args = identity_canister::c2c_set_user_ids::Args { users: users.clone() };
    let success = identity_canister_c2c_client::c2c_set_user_ids(identity_canister_id, &args)
        .await
        .is_ok();

    mutate_state(|state| {
        if !success {
            state.data.identity_canister_user_sync_queue.extend(users);
        }
        start_job_if_required(state);
    });
}
