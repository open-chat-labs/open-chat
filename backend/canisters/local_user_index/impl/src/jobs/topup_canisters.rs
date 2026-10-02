use crate::updates::c2c_notify_low_balance::top_up_child_canister;
use crate::{CanisterToRefund, RuntimeState, jobs, mutate_state, read_state};
use constants::{DAY_IN_MS, multi_user_canister_min_cycles_balance};
use oc_error_codes::OCErrorCode;
use per_round_timer::PerRoundTimer;
use std::cell::RefCell;
use std::time::Duration;
use tracing::{error, info};
use types::{CanisterId, CommunityId, Cycles, Milliseconds, TimestampMillis, UnitResult};
use utils::canister_timers::run_now_then_interval;

thread_local! {
    static TIMER: RefCell<Option<PerRoundTimer>> = RefCell::default();
}

const CYCLES_CHECK_INTERVAL: Milliseconds = 7 * DAY_IN_MS;

// One-off: hold off checking balances and topping canisters up until 09:00 UTC on Monday
// 5 October 2026, so that cycles can be recouped first. Otherwise the job runs as soon as the
// LocalUserIndex is upgraded.
// TODO remove in a release deployed after 2026-10-05T09:00:00Z. Removing it in an earlier release
// would run the checks as soon as that release is deployed.
const FIRST_RUN_NOT_BEFORE: TimestampMillis = 1_791_190_800_000; // 2026-10-05T09:00:00Z

pub fn start_job(now: TimestampMillis) {
    let delay = FIRST_RUN_NOT_BEFORE.saturating_sub(now);
    if delay == 0 {
        start_checks();
    } else {
        ic_cdk_timers::set_timer(Duration::from_millis(delay), async { start_checks() });
        info!(delay, "Top up canisters job deferred");
    }
}

fn start_checks() {
    run_now_then_interval(Duration::from_millis(CYCLES_CHECK_INTERVAL), populate_canisters);
}

fn populate_canisters() {
    mutate_state(|state| {
        if state.data.cycles_balance_check_queue.is_empty() {
            state
                .data
                .cycles_balance_check_queue
                .extend(state.data.local_users.iter_user_canisters().map(|(u, _)| u.canister_id()));
            state
                .data
                .cycles_balance_check_queue
                .extend(state.data.local_groups.iter().map(|(u, _)| CanisterId::from(*u)));
            state
                .data
                .cycles_balance_check_queue
                .extend(state.data.local_communities.iter().map(|(u, _)| CanisterId::from(*u)));
            state
                .data
                .cycles_balance_check_queue
                .extend(state.data.local_multi_user_canisters.iter().map(|(c, _)| *c));
        }
    });

    TIMER.set(Some(PerRoundTimer::new(run)));
    info!("Top up canisters job starting");
}

enum GetNextResult {
    Success(CanisterId),
    Continue,
    Break,
}

fn run() {
    match mutate_state(next) {
        GetNextResult::Success(canister_id) => utils::async_work::spawn_tracked(run_async(canister_id)),
        GetNextResult::Continue => {}
        GetNextResult::Break => {
            TIMER.set(None);
            info!("Top up canisters job finished");
        }
    }
}

fn next(state: &mut RuntimeState) -> GetNextResult {
    let mut count = 0;
    let now = state.env.now();
    while let Some(canister_id) = state.data.cycles_balance_check_queue.pop_front() {
        if let Some(cycle_top_ups) = state.child_canister_cycle_top_ups(canister_id) {
            let most_recent_top_up = cycle_top_ups.last().map(|c| c.date).unwrap_or_default();

            // Only check the balance if the most recent top up was more than 10 days ago
            if now.saturating_sub(most_recent_top_up) > 10 * DAY_IN_MS {
                return GetNextResult::Success(canister_id);
            }
        }

        count += 1;
        if count >= 1000 {
            return GetNextResult::Continue;
        }
    }

    GetNextResult::Break
}

async fn run_async(canister_id: CanisterId) {
    match utils::canister::canister_status(canister_id).await {
        Ok(status) => {
            // A community's canister only loses its code by being uninstalled, which the IC does
            // once a canister runs out of cycles. Topping it up can't bring its state back, so
            // the community is removed instead.
            if status.module_hash.is_none() {
                if read_state(|state| state.data.local_communities.contains(&canister_id.into())) {
                    notify_community_uninstalled(canister_id.into()).await;
                } else {
                    // Topping up a canister with no code would only strand the cycles in it
                    info!(%canister_id, "Not topping up a canister which has no code");
                }
            } else if utils::cycles::is_cycles_balance_low(
                status.cycles(),
                status.freeze_threshold_cycles(),
                read_state(|state| child_canister_min_cycles_balance(canister_id, state)),
            ) {
                top_up_child_canister(Some(canister_id)).await;
            }
        }
        Err(error) => error!(%canister_id, ?error, "Error getting canister status"),
    }
}

// The cycles above its freezing threshold below which a child canister is topped up, matching the
// minimum at which it asks for a top up itself
fn child_canister_min_cycles_balance(canister_id: CanisterId, state: &RuntimeState) -> Cycles {
    if state.data.local_multi_user_canisters.contains(&canister_id) {
        multi_user_canister_min_cycles_balance(state.data.test_mode)
    } else {
        utils::cycles::MIN_CYCLES_BALANCE
    }
}

// Tells the GroupIndex, which stops listing the community, then stops tracking it here. The
// canister itself is kept, empty and still controlled by this canister, since it may hold tokens
// (eg. unclaimed prizes) which deleting it would put beyond reach for good.
async fn notify_community_uninstalled(community_id: CommunityId) {
    let group_index_canister_id = read_state(|state| state.data.group_index_canister_id);

    let args = group_index_canister::c2c_notify_community_uninstalled::Args { community_id };
    match group_index_canister_c2c_client::c2c_notify_community_uninstalled(group_index_canister_id, &args).await {
        Ok(UnitResult::Success) => {}
        // The GroupIndex removed the community on an earlier notification
        Ok(UnitResult::Error(error)) if error.matches_code(OCErrorCode::CommunityNotFound) => {}
        response => {
            error!(%community_id, ?response, "Failed to notify the GroupIndex of an uninstalled community");
            return;
        }
    }

    mutate_state(|state| {
        if state.data.local_communities.delete(&community_id) {
            let canister_id = community_id.into();
            state.data.communities_requiring_upgrade.remove_failed(&canister_id);

            // Any cycles the canister still holds are refunded, as for a deleted user's canister
            state.data.cycles_refund_queue.push_back(CanisterToRefund {
                canister_id,
                attempt: 0,
                retry_after: 0,
                // Kept, since it may hold tokens (see above)
                delete_canister: false,
            });
            jobs::refund_cycles::start_job_if_required(state, None);
            info!(%community_id, "Uninstalled community removed");
        }
    });
}
