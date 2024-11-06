use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use rand::Rng;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, Empty};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.canisters_pending_events_migration_to_stable_memory.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'migrate_events_to_stable_memory' job started");
        true
    } else {
        false
    }
}

fn run() {
    if let Some(canister_id) = mutate_state(next) {
        ic_cdk::spawn(migrate_events(canister_id));
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'migrate_events_to_stable_memory' job stopped");
    }
}

fn next(state: &mut RuntimeState) -> Option<CanisterId> {
    if state.data.canisters_pending_events_migration_to_stable_memory.is_empty() {
        return None;
    }

    let len = state.data.canisters_pending_events_migration_to_stable_memory.len();
    let random: usize = state.env.rng().gen_range(0..len);

    state
        .data
        .canisters_pending_events_migration_to_stable_memory
        .get(random)
        .copied()
}

async fn migrate_events(canister_id: CanisterId) {
    if let Ok(true) = group_canister_c2c_client::c2c_migrate_events_to_stable_memory(canister_id, &Empty {}).await {
        mutate_state(|state| {
            state
                .data
                .canisters_pending_events_migration_to_stable_memory
                .retain(|c| *c != canister_id);
        });
    }
}
