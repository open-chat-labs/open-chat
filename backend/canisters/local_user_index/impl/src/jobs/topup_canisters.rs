use crate::updates::c2c_notify_low_balance::top_up_user;
use crate::{mutate_state, RuntimeState};
use candid::Nat;
use ic_cdk::api::management_canister::main::CanisterIdRecord;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::collections::VecDeque;
use std::time::Duration;
use tracing::{error, info};
use types::{Milliseconds, UserId};
use utils::canister_timers::run_now_then_interval;
use utils::time::DAY_IN_MS;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

const CYCLES_CHECK_INTERVAL: Milliseconds = 7 * DAY_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(CYCLES_CHECK_INTERVAL), populate_canisters);
}

fn populate_canisters() {
    mutate_state(|state| {
        if state.data.cycles_balance_check_queue.is_empty() {
            state.data.cycles_balance_check_queue = VecDeque::from_iter(state.data.local_users.iter().map(|(u, _)| *u));
        }
    });

    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
    let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
    TIMER_ID.set(Some(timer_id));
    info!("Top up canisters job starting");
}

fn run() {
    if let Some(user_id) = mutate_state(next) {
        ic_cdk::spawn(run_async(user_id));
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        info!("Top up canisters job finished");
    }
}

fn next(state: &mut RuntimeState) -> Option<UserId> {
    state.data.cycles_balance_check_queue.pop_front()
}

async fn run_async(user_id: UserId) {
    match ic_cdk::api::management_canister::main::canister_status(CanisterIdRecord {
        canister_id: user_id.into(),
    })
    .await
    {
        Ok((status,)) => {
            if status.cycles < Nat::from(60u32) * status.idle_cycles_burned_per_day {
                top_up_user(Some(user_id)).await;
            }
        }
        Err(error) => error!(%user_id, ?error, "Error getting canister status"),
    }
}
