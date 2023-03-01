use crate::{mutate_state, RuntimeState};
use group_canister::c2c_dismiss_super_admin;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{ChatId, UserId};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !runtime_state.data.platform_moderators_to_dismiss.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::default(), run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'dismiss_platform_moderators' job started");
        true
    } else {
        false
    }
}

fn run() {
    if let Some((user_id, group_id)) = mutate_state(pop_platform_moderator_to_dismiss) {
        ic_cdk::spawn(dismiss_platform_moderator(user_id, group_id));
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'dismiss_platform_moderators' job stopped");
    }
}

fn pop_platform_moderator_to_dismiss(runtime_state: &mut RuntimeState) -> Option<(UserId, ChatId)> {
    runtime_state.data.platform_moderators_to_dismiss.pop_front()
}

fn push_platform_moderator_to_dismiss(user_id: UserId, group_id: ChatId, runtime_state: &mut RuntimeState) {
    runtime_state
        .data
        .platform_moderators_to_dismiss
        .push_back((user_id, group_id));
}

async fn dismiss_platform_moderator(user_id: UserId, group_id: ChatId) {
    let c2c_args = c2c_dismiss_super_admin::Args {
        user_id,
        correlation_id: 0,
    };
    if let Err(error) = group_canister_c2c_client::c2c_dismiss_super_admin(group_id.into(), &c2c_args).await {
        error!(?error, ?user_id, ?group_id, "Error calling group::c2c_dismiss_super_admin");
        mutate_state(|state| push_platform_moderator_to_dismiss(user_id, group_id, state));
    }
}
