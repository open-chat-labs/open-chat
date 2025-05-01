use crate::guards::caller_is_local_user_canister;
use crate::{CHILD_CANISTER_TOP_UP_AMOUNT, RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::min_cycles_balance;
use types::{CanisterId, Cycles, CyclesTopUp, NotifyLowBalanceArgs, NotifyLowBalanceResponse};
use utils::canister::deposit_cycles;
use utils::cycles::can_spend_cycles;

#[update(guard = "caller_is_local_user_canister", msgpack = true)]
#[trace]
async fn c2c_notify_low_balance(_args: NotifyLowBalanceArgs) -> NotifyLowBalanceResponse {
    top_up_child_canister(None).await
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
    }
}
