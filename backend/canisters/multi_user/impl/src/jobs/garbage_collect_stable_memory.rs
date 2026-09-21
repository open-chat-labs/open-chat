use crate::{Data, mutate_state};
use ic_cdk_timers::TimerId;
use stable_memory_map::{KeyScope, with_key_scope};
use std::cell::Cell;
use std::time::Duration;
use tracing::{info, trace};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(data: &Data) -> bool {
    if TIMER_ID.get().is_none()
        && (!data.stable_memory_keys_to_garbage_collect.is_empty() || !data.deleted_users_to_garbage_collect.is_empty())
    {
        let timer_id = ic_cdk_timers::set_timer(Duration::from_secs(10), async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

// As in the User canister, except that each prefix is removed within the key scope of the user
// whose chat it belonged to, since that is where its entries are keyed. Deleted users then have
// all of their entries removed.
fn run() {
    trace!("'garbage_collect_stable_memory' job running");
    TIMER_ID.set(None);
    mutate_state(|state| {
        let mut complete = true;
        while let Some((user_index, prefix)) = state.data.stable_memory_keys_to_garbage_collect.pop() {
            let result = with_key_scope(KeyScope::User(user_index), || {
                stable_memory_map::garbage_collect(prefix.clone())
            });
            let (count, done) = match result {
                Ok(c) => (c, true),
                Err(c) => (c, false),
            };
            info!(count, complete = done, "Garbage collected keys from stable memory");
            if !done {
                complete = false;
                state.data.stable_memory_keys_to_garbage_collect.push((user_index, prefix));
                break;
            }
        }
        while complete && let Some(user_index) = state.data.deleted_users_to_garbage_collect.pop() {
            let result = stable_memory_map::garbage_collect_user(user_index);
            let count = match result {
                Ok(c) => c,
                Err(c) => {
                    complete = false;
                    c
                }
            };
            info!(
                count,
                complete, user_index, "Garbage collected a deleted user's keys from stable memory"
            );
            if !complete {
                state.data.deleted_users_to_garbage_collect.push(user_index);
            }
        }
        start_job_if_required(&state.data);
    });
}
