use crate::{RuntimeState, jobs, mutate_state, run_regular_jobs};
use group_community_common::ExpiringMember;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;

// Once a group's access gate has been removed, the members who had lapsed are unlapsed. Each is
// written to stable memory, so a great many are unlapsed a batch at a time (see
// `GroupMembers::unlapse_while`).

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

const MAX_INSTRUCTIONS_PER_RUN: u64 = 2_000_000_000;
// In test mode only one member is unlapsed per run, so that tests cover the job running again
const MAX_MEMBERS_PER_RUN_TEST_MODE: u32 = 1;

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.chat.members.is_unlapsing() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'unlapse_members' job running");
    TIMER_ID.set(None);
    run_regular_jobs();

    mutate_state(|state| {
        let now = state.env.now();
        let max_members = if state.data.test_mode { MAX_MEMBERS_PER_RUN_TEST_MODE } else { u32::MAX };
        let mut processed = 0u32;
        let unlapsed = state.data.chat.members.unlapse_while(now, || {
            processed += 1;
            processed <= max_members
                && (!processed.is_multiple_of(100) || ic_cdk::api::instruction_counter() < MAX_INSTRUCTIONS_PER_RUN)
        });

        // If an expiring gate has been set since the gate was removed, then had these members been
        // unlapsed straight away, they would have been due to expire under the new gate from when
        // it was set
        let gate_config = &state.data.chat.gate_config;
        if let Some(expiry) = gate_config.value.as_ref().and_then(|g| g.expiry())
            && !unlapsed.is_empty()
        {
            for user_id in unlapsed {
                state.data.expiring_members.push(ExpiringMember {
                    expires: gate_config.timestamp + expiry,
                    channel_id: None,
                    user_id,
                });
            }
            jobs::expire_members::restart_job(state);
        }

        start_job_if_required(state);
    });
}
