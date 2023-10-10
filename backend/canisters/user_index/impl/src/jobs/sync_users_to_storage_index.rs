use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;
use tracing::trace;
use types::CanisterId;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none())
        && !state.data.storage_index_user_sync_queue.is_empty()
        && !state.data.storage_index_user_sync_queue.sync_in_progress()
    {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'sync_users_to_storage_index' job started");
        true
    } else {
        false
    }
}

fn run() {
    if let Some((canister_id, users)) = mutate_state(|state| {
        state
            .data
            .storage_index_user_sync_queue
            .try_start_sync()
            .map(|u| (state.data.storage_index_canister_id, u))
    }) {
        ic_cdk::spawn(sync_users(canister_id, users));
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'sync_users_to_storage_index' job stopped");
    }
}

async fn sync_users(storage_index_canister_id: CanisterId, users: Vec<UserConfig>) {
    let args = storage_index_canister::add_or_update_users::Args { users: users.clone() };
    let success = storage_index_canister_c2c_client::add_or_update_users(storage_index_canister_id, &args)
        .await
        .is_ok();

    mutate_state(|state| {
        if success {
            state.data.storage_index_user_sync_queue.mark_sync_completed();
        } else {
            state.data.storage_index_user_sync_queue.mark_sync_failed(users);
        }
        start_job_if_required(state);
    });
}
