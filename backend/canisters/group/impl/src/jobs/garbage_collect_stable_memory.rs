use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{info, trace};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.stable_memory_keys_to_garbage_collect.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::from_secs(10), run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'garbage_collect_stable_memory' job running");
    TIMER_ID.set(None);
    mutate_state(|state| {
        while let Some(prefix) = state.data.stable_memory_keys_to_garbage_collect.pop() {
            let result = chat_events::ChatEvents::garbage_collect_stable_memory(prefix.clone());
            let (count, complete) = match result {
                Ok(c) => (c, true),
                Err(c) => (c, false),
            };
            let thread_root_message_index = prefix.thread_root_message_index();
            info!(
                count,
                ?thread_root_message_index,
                complete,
                "Garbage collected keys from stable memory"
            );
            if !complete {
                state.data.stable_memory_keys_to_garbage_collect.push(prefix);
                break;
            }
        }
        start_job_if_required(state);
    });
}
