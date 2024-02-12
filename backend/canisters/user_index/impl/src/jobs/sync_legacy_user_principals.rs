use crate::{mutate_state, RuntimeState};
use candid::Principal;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;
use types::CanisterId;

const BATCH_SIZE: usize = 1000;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.legacy_principals_sync_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub(crate) fn try_run_now(state: &mut RuntimeState) -> bool {
    if let Some((canister_id, principals)) = next_batch(state) {
        if let Some(timer_id) = TIMER_ID.take() {
            ic_cdk_timers::clear_timer(timer_id);
        }
        ic_cdk::spawn(sync_principals(canister_id, principals));
        true
    } else {
        false
    }
}

fn run() {
    info!("'sync_legacy_user_principals' job running");
    TIMER_ID.set(None);

    if let Some((canister_id, principals)) = mutate_state(next_batch) {
        ic_cdk::spawn(sync_principals(canister_id, principals));
    }
}

fn next_batch(state: &mut RuntimeState) -> Option<(CanisterId, Vec<Principal>)> {
    let batch: Vec<_> = (0..BATCH_SIZE)
        .map_while(|_| state.data.legacy_principals_sync_queue.pop_front())
        .collect();

    if batch.is_empty() {
        None
    } else {
        Some((state.data.identity_canister_id, batch))
    }
}

async fn sync_principals(identity_canister_id: CanisterId, principals: Vec<Principal>) {
    let args = identity_canister::c2c_sync_legacy_user_principals::Args {
        principals: principals.clone(),
    };
    if identity_canister_c2c_client::c2c_sync_legacy_user_principals(identity_canister_id, &args)
        .await
        .is_err()
    {
        mutate_state(|state| {
            state.data.legacy_principals_sync_queue.extend(principals);
            start_job_if_required(state);
        });
    }
}
