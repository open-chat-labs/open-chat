use crate::guards::caller_is_local_child_canister;
use crate::{RuntimeState, child_top_up_amount, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{MINUTE_IN_MS, min_cycles_balance};
use local_user_index_canister::ChildCanisterType;
use std::cell::RefCell;
use std::collections::HashSet;
use types::{
    C2CError, CanisterId, Cycles, CyclesTopUp, Milliseconds, NotifyLowBalanceArgs, NotifyLowBalanceResponse, TimestampMillis,
};
use utils::canister::{deposit_cycles, is_out_of_cycles_error};
use utils::cycles::can_spend_cycles;

// A call which finds a child out of cycles this soon after it was topped up is retried without
// topping it up again, since the call most likely failed before the top up landed. Otherwise each
// of a burst of calls to a child which has run out of cycles would top it up.
const RECENT_TOP_UP_WINDOW: Milliseconds = MINUTE_IN_MS;

thread_local! {
    static TOP_UPS_IN_PROGRESS: RefCell<HashSet<CanisterId>> = RefCell::default();
}

#[update(guard = "caller_is_local_child_canister", msgpack = true)]
#[trace]
async fn c2c_notify_low_balance(_args: NotifyLowBalanceArgs) -> NotifyLowBalanceResponse {
    top_up_child_canister(None, 0).await
}

// Makes a call to `canister_id`. If it is one of this canister's children and the call fails
// because the child is out of cycles, the child is topped up and the call is made again. Retrying
// is safe, since a canister which is out of cycles rejects the call without executing it.
pub(crate) async fn top_up_and_retry_if_out_of_cycles<R, F, Fut>(canister_id: CanisterId, call: F) -> Result<R, C2CError>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<R, C2CError>>,
{
    let result = call().await;
    let out_of_cycles = matches!(&result, Err(error) if is_out_of_cycles_error(error.reject_code(), error.message()));

    if out_of_cycles && top_up_for_retry(canister_id).await { call().await } else { result }
}

// Tops up a child which a call found to be out of cycles, returning whether the call should be
// retried. A child which is already being topped up isn't topped up again, and the call isn't
// retried, since the top up may not have landed by the time it would be.
async fn top_up_for_retry(canister_id: CanisterId) -> bool {
    let action = read_state(|state| {
        let top_ups = state.child_canister_cycle_top_ups(canister_id);
        out_of_cycles_action(
            top_ups.is_some(),
            top_ups.and_then(|t| t.last()).map(|t| t.date),
            state.env.now(),
        )
    });

    match action {
        OutOfCyclesAction::Fail => false,
        OutOfCyclesAction::Retry => true,
        OutOfCyclesAction::TopUpThenRetry => match TopUpInProgressGuard::new(canister_id) {
            Some(_guard) => matches!(
                top_up_child_canister(Some(canister_id), 0).await,
                NotifyLowBalanceResponse::Success(_)
            ),
            None => false,
        },
    }
}

#[derive(Debug, PartialEq, Eq)]
enum OutOfCyclesAction {
    Fail,
    Retry,
    TopUpThenRetry,
}

fn out_of_cycles_action(is_child: bool, last_top_up: Option<TimestampMillis>, now: TimestampMillis) -> OutOfCyclesAction {
    if !is_child {
        // Only this canister's own children are topped up
        OutOfCyclesAction::Fail
    } else if last_top_up.is_some_and(|date| now.saturating_sub(date) < RECENT_TOP_UP_WINDOW) {
        OutOfCyclesAction::Retry
    } else {
        OutOfCyclesAction::TopUpThenRetry
    }
}

// Removes the canister from `TOP_UPS_IN_PROGRESS` when dropped, which also happens if the callback
// following the top up traps
struct TopUpInProgressGuard(CanisterId);

impl TopUpInProgressGuard {
    fn new(canister_id: CanisterId) -> Option<TopUpInProgressGuard> {
        TOP_UPS_IN_PROGRESS
            .with_borrow_mut(|c| c.insert(canister_id))
            .then_some(TopUpInProgressGuard(canister_id))
    }
}

impl Drop for TopUpInProgressGuard {
    fn drop(&mut self) {
        TOP_UPS_IN_PROGRESS.with_borrow_mut(|c| c.remove(&self.0));
    }
}

// Tops the canister up by the usual amount for its type, plus `additional`
pub(crate) async fn top_up_child_canister(canister_id: Option<CanisterId>, additional: Cycles) -> NotifyLowBalanceResponse {
    let prepare_ok = match read_state(|state| prepare(canister_id, additional, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };
    let amount = prepare_ok.top_up.amount;

    if deposit_cycles(prepare_ok.canister_id, amount).await.is_ok() {
        mutate_state(|state| commit(prepare_ok.canister_id, prepare_ok.top_up, state));
        NotifyLowBalanceResponse::Success(amount)
    } else {
        NotifyLowBalanceResponse::FailedToDepositCycles
    }
}

struct PrepareResult {
    canister_id: CanisterId,
    top_up: CyclesTopUp,
}

fn prepare(
    canister_id: Option<CanisterId>,
    additional: Cycles,
    state: &RuntimeState,
) -> Result<PrepareResult, NotifyLowBalanceResponse> {
    let canister_id = canister_id.unwrap_or_else(|| state.env.caller());
    let amount = top_up_amount(canister_id, state) + additional;
    let top_up = CyclesTopUp {
        date: state.env.now(),
        amount,
    };

    if can_spend_cycles(amount, min_cycles_balance(state.data.test_mode)) {
        Ok(PrepareResult { canister_id, top_up })
    } else {
        Err(NotifyLowBalanceResponse::NotEnoughCyclesRemaining)
    }
}

pub(crate) fn top_up_amount(canister_id: CanisterId, state: &RuntimeState) -> Cycles {
    // Only this canister's children are topped up, so the fallback should never be needed
    let canister_type = state.child_canister_type(canister_id).unwrap_or(ChildCanisterType::Group);
    child_top_up_amount(canister_type, state.data.test_mode)
}

fn commit(canister_id: CanisterId, top_up: CyclesTopUp, state: &mut RuntimeState) {
    state.data.total_cycles_spent_on_canisters += top_up.amount;
    if state.data.local_users.contains(&canister_id.into()) {
        state.data.local_users.mark_cycles_top_up(&canister_id.into(), top_up);
    } else if state.data.local_groups.contains(&canister_id.into()) {
        state.data.local_groups.mark_cycles_top_up(&canister_id.into(), top_up);
    } else if state.data.local_communities.contains(&canister_id.into()) {
        state.data.local_communities.mark_cycles_top_up(&canister_id.into(), top_up);
    } else if state.data.local_multi_user_canisters.contains(&canister_id) {
        state.data.local_multi_user_canisters.mark_cycles_top_up(&canister_id, top_up);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: TimestampMillis = 1_000 * MINUTE_IN_MS;

    #[test]
    fn a_canister_which_is_not_a_child_is_never_topped_up() {
        assert_eq!(out_of_cycles_action(false, None, NOW), OutOfCyclesAction::Fail);
        assert_eq!(out_of_cycles_action(false, Some(NOW), NOW), OutOfCyclesAction::Fail);
    }

    #[test]
    fn a_child_is_topped_up_unless_it_was_topped_up_moments_ago() {
        assert_eq!(out_of_cycles_action(true, None, NOW), OutOfCyclesAction::TopUpThenRetry);
        assert_eq!(
            out_of_cycles_action(true, Some(NOW - RECENT_TOP_UP_WINDOW), NOW),
            OutOfCyclesAction::TopUpThenRetry
        );
    }

    // The call most likely failed before the top up landed, so it is retried without another top up
    #[test]
    fn a_child_topped_up_moments_ago_is_retried_without_another_top_up() {
        assert_eq!(out_of_cycles_action(true, Some(NOW), NOW), OutOfCyclesAction::Retry);
        assert_eq!(
            out_of_cycles_action(true, Some(NOW - RECENT_TOP_UP_WINDOW + 1), NOW),
            OutOfCyclesAction::Retry
        );
    }
}
