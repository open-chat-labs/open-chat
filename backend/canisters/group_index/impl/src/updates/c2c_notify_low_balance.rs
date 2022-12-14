use crate::{mutate_state, read_state, RuntimeState, LOCAL_GROUP_INDEX_CANISTER_TOP_UP_AMOUNT};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::{CanisterId, CyclesTopUp, NotifyLowBalanceArgs, NotifyLowBalanceResponse};
use utils::consts::MIN_CYCLES_BALANCE;
use utils::cycles::{can_spend_cycles, top_up_canister};

#[update_msgpack]
#[trace]
async fn c2c_notify_low_balance(_args: NotifyLowBalanceArgs) -> NotifyLowBalanceResponse {
    let prepare_ok = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };
    let amount = prepare_ok.top_up.amount;

    if top_up_canister(prepare_ok.canister_id, amount).await.is_ok() {
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

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, NotifyLowBalanceResponse> {
    let canister_id: CanisterId = runtime_state.env.caller();

    if !runtime_state.data.local_index_map.index_exists(&canister_id) {
        panic!("Caller not recognised. {canister_id}");
    };

    let top_up_amount = LOCAL_GROUP_INDEX_CANISTER_TOP_UP_AMOUNT;
    let top_up = CyclesTopUp {
        date: runtime_state.env.now(),
        amount: top_up_amount,
    };

    if can_spend_cycles(top_up_amount, MIN_CYCLES_BALANCE) {
        Ok(PrepareResult { canister_id, top_up })
    } else {
        Err(NotifyLowBalanceResponse::NotEnoughCyclesRemaining)
    }
}

fn commit(canister_id: CanisterId, top_up: CyclesTopUp, runtime_state: &mut RuntimeState) {
    runtime_state.data.total_cycles_spent_on_canisters += top_up.amount as u128;
    runtime_state.data.local_index_map.mark_cycles_top_up(canister_id, top_up);
}
