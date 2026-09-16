use crate::{RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{info, trace};

const MAX_INSTRUCTIONS_PER_RUN: u64 = 2_000_000_000;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Moves the events of direct chats created before `key_id`s were introduced from their legacy
// stable memory keys (based on the other user's id) to keys based on their `key_id`. Most canisters
// finish this within `post_upgrade`, the rest continue here. This can be removed once every user
// canister has been migrated.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && direct_chats_with_legacy_events(state) > 0 {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'migrate_direct_chat_events_to_key_id_keys' job running");
    TIMER_ID.set(None);
    mutate_state(|state| {
        let complete = run_batch(state, max_instructions(state, MAX_INSTRUCTIONS_PER_RUN));
        if !complete {
            start_job_if_required(state);
        }
        info!(complete, "Migrated direct chat events to key_id keys");
    });
}

// Migrates batches of events (each holding at most 100 events) until either every chat is done or
// more than `max_instructions` have been used in the current call, checking the instruction count
// after every batch. At least one batch is always migrated, so the migration always progresses.
// Returns true if every chat is done.
pub(crate) fn run_batch(state: &mut RuntimeState, max_instructions: u64) -> bool {
    'chats: for chat in state.data.direct_chats.iter_mut() {
        while chat.core.events.has_legacy_events() {
            chat.core.events.migrate_legacy_events_batch();
            if ic_cdk::api::instruction_counter() > max_instructions {
                break 'chats;
            }
        }
    }
    direct_chats_with_legacy_events(state) == 0
}

// In test mode a single batch is migrated per call, so that integration tests can exercise the
// migration being spread across `post_upgrade` and multiple runs of this job
pub(crate) fn max_instructions(state: &RuntimeState, max_instructions: u64) -> u64 {
    if state.data.test_mode { 0 } else { max_instructions }
}

pub(crate) fn direct_chats_with_legacy_events(state: &RuntimeState) -> usize {
    state
        .data
        .direct_chats
        .iter()
        .filter(|c| c.core.events.has_legacy_events())
        .count()
}
