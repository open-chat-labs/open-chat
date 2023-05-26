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
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.storage_index_user_sync_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'sync_users_to_storage_index' job started");
        true
    } else {
        false
    }
}

fn run() {
    match mutate_state(try_get_next) {
        GetNextResult::Success((canister_id, users)) => {
            ic_cdk::spawn(sync_users(canister_id, users));
        }
        GetNextResult::Continue => {}
        GetNextResult::QueueEmpty => {
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("'sync_users_to_storage_index' job stopped");
            }
        }
    }
}

enum GetNextResult {
    Success((CanisterId, Vec<UserConfig>)),
    Continue,
    QueueEmpty,
}

fn try_get_next(state: &mut RuntimeState) -> GetNextResult {
    if state.data.storage_index_user_sync_queue.is_empty() {
        GetNextResult::QueueEmpty
    } else if let Some(users) = state.data.storage_index_user_sync_queue.try_start_sync() {
        GetNextResult::Success((state.data.storage_index_canister_id, users))
    } else {
        GetNextResult::Continue
    }
}

async fn sync_users(storage_index_canister_id: CanisterId, users: Vec<UserConfig>) {
    let args = storage_index_canister::add_or_update_users::Args { users: users.clone() };
    match storage_index_canister_c2c_client::add_or_update_users(storage_index_canister_id, &args).await {
        Ok(_) => mutate_state(on_success),
        Err(_) => mutate_state(|state| on_failure(users, state)),
    }
}

fn on_success(state: &mut RuntimeState) {
    state.data.storage_index_user_sync_queue.mark_sync_completed();
}

fn on_failure(users: Vec<UserConfig>, state: &mut RuntimeState) {
    state.data.storage_index_user_sync_queue.mark_sync_failed(users);
    start_job_if_required(state);
}
