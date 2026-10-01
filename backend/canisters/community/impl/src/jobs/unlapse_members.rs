use crate::{RuntimeState, jobs, mutate_state};
use group_community_common::ExpiringMember;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{ChannelId, TimestampMillis, UserId};

// Once the access gate of a community, or of one of its channels, has been removed, the members who
// had lapsed are unlapsed. Each is written to stable memory, so a great many are unlapsed a batch at
// a time (see `CommunityMembers::unlapse_while` and `GroupMembers::unlapse_while`).

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

const MAX_INSTRUCTIONS_PER_RUN: u64 = 2_000_000_000;

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && is_required(state) {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn is_required(state: &RuntimeState) -> bool {
    state.data.members.is_unlapsing() || state.data.channels.iter().any(|c| c.chat.members.is_unlapsing())
}

fn run() {
    trace!("'unlapse_members' job running");
    TIMER_ID.set(None);

    mutate_state(|state| {
        let now = state.env.now();
        let mut processed = 0u32;
        let mut stopped = false;
        let mut keep_going = || {
            if !stopped {
                processed += 1;
                stopped = processed.is_multiple_of(100) && ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_RUN;
            }
            !stopped
        };

        // If an expiring gate has been set since the gate was removed, then had these members been
        // unlapsed straight away, they would have been due to expire under the new gate from when
        // it was set
        let mut to_expire: Vec<ExpiringMember> = Vec::new();
        let mut expire_under_gate =
            |gate_expires_from: Option<TimestampMillis>, channel_id: Option<ChannelId>, unlapsed: Vec<UserId>| {
                if let Some(expires) = gate_expires_from {
                    to_expire.extend(unlapsed.into_iter().map(|user_id| ExpiringMember {
                        expires,
                        channel_id,
                        user_id,
                    }));
                }
            };

        if state.data.members.is_unlapsing() {
            let unlapsed = state.data.members.unlapse_while(now, &mut keep_going);
            let gate_config = &state.data.gate_config;
            let expires = gate_config
                .value
                .as_ref()
                .and_then(|g| g.expiry())
                .map(|e| gate_config.timestamp + e);
            expire_under_gate(expires, None, unlapsed);
        }
        for channel in state.data.channels.iter_mut() {
            if channel.chat.members.is_unlapsing() {
                let unlapsed = channel.chat.members.unlapse_while(now, &mut keep_going);
                let gate_config = &channel.chat.gate_config;
                let expires = gate_config
                    .value
                    .as_ref()
                    .and_then(|g| g.expiry())
                    .map(|e| gate_config.timestamp + e);
                expire_under_gate(expires, Some(channel.id), unlapsed);
            }
        }

        if !to_expire.is_empty() {
            for member in to_expire {
                state.data.expiring_members.push(member);
            }
            jobs::expire_members::restart_job(state);
        }

        start_job_if_required(state);
    });
}
