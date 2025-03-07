use crate::read_state;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::CanisterId;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.remove_from_online_users_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    trace!("'remove_from_online_users_canister' job running");
    TIMER_ID.set(None);

    if let Some((canister_id, principal)) = mutate_state(|state| {
        state
            .data
            .remove_from_online_users_queue
            .pop_front()
            .map(|p| (state.data.online_users_canister_id, p))
    }) {
        ic_cdk::futures::spawn(remove_user(canister_id, principal));
    }
}

async fn remove_user(canister_id: CanisterId, principal: Principal) {
    let args = online_users_canister::c2c_remove_user::Args { principal };
    if online_users_canister_c2c_client::c2c_remove_user(canister_id, &args)
        .await
        .is_err()
    {
        mutate_state(|state| {
            state.data.remove_from_online_users_queue.push_back(principal);
        });
    }
    read_state(start_job_if_required);
}
