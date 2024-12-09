use crate::guards::caller_is_local_group_or_community_canister;
use crate::{mutate_state, read_state, RuntimeState, COMMUNITY_CANISTER_TOP_UP_AMOUNT, GROUP_CANISTER_TOP_UP_AMOUNT};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::min_cycles_balance;
use types::{CanisterId, CyclesTopUp, NotifyLowBalanceArgs, NotifyLowBalanceResponse};
use utils::canister::deposit_cycles;
use utils::cycles::can_spend_cycles;

#[update(guard = "caller_is_local_group_or_community_canister", msgpack = true)]
#[trace]
async fn c2c_notify_low_balance(_args: NotifyLowBalanceArgs) -> NotifyLowBalanceResponse {
    top_up_canister(None).await
}

pub(crate) async fn top_up_canister(canister_id: Option<CanisterId>) -> NotifyLowBalanceResponse {
    let prepare_ok = match read_state(|state| prepare(canister_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };
    let amount = prepare_ok.top_up.amount;

    if deposit_cycles(prepare_ok.canister_id, amount).await.is_ok() {
        mutate_state(|state| commit(prepare_ok.canister_id, prepare_ok.top_up, prepare_ok.is_group, state));
        NotifyLowBalanceResponse::Success(amount)
    } else {
        NotifyLowBalanceResponse::FailedToDepositCycles
    }
}

struct PrepareResult {
    canister_id: CanisterId,
    top_up: CyclesTopUp,
    is_group: bool,
}

fn prepare(canister_id: Option<CanisterId>, state: &RuntimeState) -> Result<PrepareResult, NotifyLowBalanceResponse> {
    let canister_id = canister_id.unwrap_or_else(|| state.env.caller());
    let is_group = state.is_caller_local_group_canister();

    let top_up_amount = if is_group { GROUP_CANISTER_TOP_UP_AMOUNT } else { COMMUNITY_CANISTER_TOP_UP_AMOUNT };
    let top_up = CyclesTopUp {
        date: state.env.now(),
        amount: top_up_amount,
    };

    if can_spend_cycles(top_up_amount, min_cycles_balance(state.data.test_mode)) {
        Ok(PrepareResult {
            canister_id,
            top_up,
            is_group,
        })
    } else {
        Err(NotifyLowBalanceResponse::NotEnoughCyclesRemaining)
    }
}

fn commit(canister_id: CanisterId, top_up: CyclesTopUp, is_group: bool, state: &mut RuntimeState) {
    state.data.total_cycles_spent_on_canisters += top_up.amount;

    if is_group {
        if !state.data.local_groups.mark_cycles_top_up(&canister_id.into(), top_up) {
            panic!("Group not found. {canister_id}");
        }
    } else if !state.data.local_communities.mark_cycles_top_up(&canister_id.into(), top_up) {
        panic!("Community not found. {canister_id}");
    }
}
