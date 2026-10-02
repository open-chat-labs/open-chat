use crate::guards::caller_is_local_child_canister;
use crate::{CHILD_CANISTER_TOP_UP_AMOUNT, RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{MINUTE_IN_MS, min_cycles_balance};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{C2CError, CanisterId, Cycles, CyclesTopUp, Milliseconds, NotifyLowBalanceArgs, NotifyLowBalanceResponse};
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
    top_up_child_canister(None).await
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
// retried. A child which was topped up moments ago isn't topped up again, nor is one which is
// already being topped up, in which case the call isn't retried, since the top up may not have
// landed by the time it would be.
async fn top_up_for_retry(canister_id: CanisterId) -> bool {
    let recently_topped_up = read_state(|state| {
        let now = state.env.now();
        state.child_canister_cycle_top_ups(canister_id).map(|top_ups| {
            top_ups
                .last()
                .is_some_and(|t| now.saturating_sub(t.date) < RECENT_TOP_UP_WINDOW)
        })
    });

    match recently_topped_up {
        Some(true) => true,
        Some(false) => match TopUpInProgressGuard::new(canister_id) {
            Some(_guard) => matches!(
                top_up_child_canister(Some(canister_id)).await,
                NotifyLowBalanceResponse::Success(_)
            ),
            None => false,
        },
        // Not one of this canister's children
        None => false,
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

pub(crate) async fn top_up_child_canister(canister_id: Option<CanisterId>) -> NotifyLowBalanceResponse {
    let prepare_ok = match read_state(|state| prepare(canister_id, CHILD_CANISTER_TOP_UP_AMOUNT, state)) {
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
    amount: Cycles,
    state: &RuntimeState,
) -> Result<PrepareResult, NotifyLowBalanceResponse> {
    let top_up = CyclesTopUp {
        date: state.env.now(),
        amount,
    };

    if can_spend_cycles(amount, min_cycles_balance(state.data.test_mode)) {
        Ok(PrepareResult {
            canister_id: canister_id.unwrap_or_else(|| state.env.caller()),
            top_up,
        })
    } else {
        Err(NotifyLowBalanceResponse::NotEnoughCyclesRemaining)
    }
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
