use crate::updates::c2c_notify_low_balance::top_up_canister;
use crate::{mutate_state, RuntimeState};
use candid::Nat;
use ic_cdk::api::management_canister::main::CanisterIdRecord;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::collections::VecDeque;
use std::time::Duration;
use tracing::{error, info};
use types::{CanisterId, ChatId, CommunityId, Milliseconds};
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
            state.data.cycles_balance_check_queue = VecDeque::from_iter(
                state
                    .data
                    .local_communities
                    .iter()
                    .map(|(c, _)| CanisterId::from(*c))
                    .chain(state.data.local_groups.iter().map(|(g, _)| CanisterId::from(*g))),
            );
        }
    });

    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
    let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
    TIMER_ID.set(Some(timer_id));
    info!("Top up canisters job starting");
}

enum GetNextResult {
    Success(CanisterId),
    Continue,
    Break,
}

fn run() {
    match mutate_state(next) {
        GetNextResult::Success(canister_id) => {
            ic_cdk::spawn(run_async(canister_id));
        }
        GetNextResult::Continue => {}
        GetNextResult::Break => {
            if let Some(timer_id) = TIMER_ID.take() {
                ic_cdk_timers::clear_timer(timer_id);
                info!("Top up canisters job finished");
            }
        }
    }
}

fn next(state: &mut RuntimeState) -> GetNextResult {
    let mut count = 0;
    let now = state.env.now();
    while let Some(canister_id) = state.data.cycles_balance_check_queue.pop_front() {
        let most_recent_top_up = if let Some(group) = state.data.local_groups.get(&ChatId::from(canister_id)) {
            group.cycle_top_ups.last().map(|c| c.date).unwrap_or_default()
        } else if let Some(community) = state.data.local_communities.get(&CommunityId::from(canister_id)) {
            community.cycle_top_ups.last().map(|c| c.date).unwrap_or_default()
        } else {
            now
        };

        // Only check the balance if the most recent top up was more than 10 days ago
        if now.saturating_sub(most_recent_top_up) > 10 * DAY_IN_MS {
            return GetNextResult::Success(canister_id);
        }

        count += 1;
        if count >= 1000 {
            return GetNextResult::Continue;
        }
    }

    GetNextResult::Break
}

async fn run_async(canister_id: CanisterId) {
    match ic_cdk::api::management_canister::main::canister_status(CanisterIdRecord { canister_id }).await {
        Ok((status,)) => {
            if status.cycles < utils::cycles::MIN_CYCLES_BALANCE
                || status.cycles < Nat::from(60u32) * status.idle_cycles_burned_per_day
            {
                top_up_canister(Some(canister_id)).await;
            }
        }
        Err(error) => error!(%canister_id, ?error, "Error getting canister status"),
    }
}
