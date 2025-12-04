use crate::updates::suspend_user::suspend_user_impl;
use crate::{RuntimeState, mutate_state};
use constants::OPENCHAT_BOT_USER_ID;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use types::UserId;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.users_to_suspend.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    if let Some(user_id) = mutate_state(get_next) {
        ic_cdk::futures::spawn(async move {
            let response = suspend_user_impl(user_id, None, "Scammer".to_string(), OPENCHAT_BOT_USER_ID).await;
            if matches!(response, user_index_canister::suspend_user::Response::InternalError(_)) {
                mutate_state(|state| {
                    state.data.users_to_suspend.push_back(user_id);
                    start_job_if_required(state);
                });
            }
        });
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
}

fn get_next(state: &mut RuntimeState) -> Option<UserId> {
    while let Some(user_id) = state.data.users_to_suspend.pop_front() {
        if state
            .data
            .users
            .get_by_user_id(&user_id)
            .is_some_and(|u| u.suspension_details.is_none())
        {
            return Some(user_id);
        }
    }
    None
}
