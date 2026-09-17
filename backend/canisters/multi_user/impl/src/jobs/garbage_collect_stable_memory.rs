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
    if TIMER_ID.get().is_none() && !data.stable_memory_keys_to_garbage_collect.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::from_secs(10), async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

// As in the User canister, except that the prefixes are those of direct chat cores, whose entries
// are keyed under the canister rather than under a user
fn run() {
    trace!("'garbage_collect_stable_memory' job running");
    TIMER_ID.set(None);
    mutate_state(|state| {
        while let Some(prefix) = state.data.stable_memory_keys_to_garbage_collect.pop() {
            let result = with_key_scope(KeyScope::Canister, || stable_memory_map::garbage_collect(prefix.clone()));
            let (count, complete) = match result {
                Ok(c) => (c, true),
                Err(c) => (c, false),
            };
            info!(count, complete, "Garbage collected keys from stable memory");
            if !complete {
                state.data.stable_memory_keys_to_garbage_collect.push(prefix);
                break;
            }
        }
        start_job_if_required(&state.data);
    });
}
