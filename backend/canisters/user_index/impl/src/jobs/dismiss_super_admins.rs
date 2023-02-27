use tracing::{error, trace};
use group_canister::c2c_dismiss_super_admin;
use types::{ChatId, UserId};
use crate::{mutate_state, RuntimeState};
use std::cell::Cell;
use std::time::Duration;
use ic_cdk_timers::TimerId;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !runtime_state.data.set_user_suspended_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::default(), run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'dismiss_super_admins' job started");
        true
    } else {
        false
    }
}

fn run() {
    if let Some((user_id, group_id)) = mutate_state(pop_super_admin_to_dismiss) {
        ic_cdk::spawn(dismiss_super_admin(user_id, group_id));
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'dismiss_super_admins' job stopped");
    }
}

fn pop_super_admin_to_dismiss(runtime_state: &mut RuntimeState) -> Option<(UserId, ChatId)> {
    runtime_state.data.super_admins_to_dismiss.pop_front()
}

fn push_super_admin_to_dismiss(user_id: UserId, group_id: ChatId, runtime_state: &mut RuntimeState) {
    runtime_state.data.super_admins_to_dismiss.push_back((user_id, group_id));
}

async fn dismiss_super_admin(user_id: UserId, group_id: ChatId) {
    let c2c_args = c2c_dismiss_super_admin::Args {
        user_id,
        correlation_id: 0,
    };
    if let Err(error) = group_canister_c2c_client::c2c_dismiss_super_admin(group_id.into(), &c2c_args).await {
        error!(?error, ?user_id, ?group_id, "Error calling group::c2c_dismiss_super_admin");
        mutate_state(|state| push_super_admin_to_dismiss(user_id, group_id, state));
    }
}