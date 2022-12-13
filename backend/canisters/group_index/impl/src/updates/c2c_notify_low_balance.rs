use crate::{mutate_state, read_state, RuntimeState, GROUP_CANISTER_TOP_UP_AMOUNT, LOCAL_GROUP_INDEX_CANISTER_TOP_UP_AMOUNT};
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

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, NotifyLowBalanceResponse> {
    let canister_id: CanisterId = runtime_state.env.caller();

    let is_group = if runtime_state.data.chat_exists(&canister_id.into()) {
        true
    } else if runtime_state.data.local_index_map.index_exists(&canister_id) {
        false
    } else {
        panic!("Caller not recognised. {canister_id}");
    };

    let top_up_amount = if is_group { GROUP_CANISTER_TOP_UP_AMOUNT } else { LOCAL_GROUP_INDEX_CANISTER_TOP_UP_AMOUNT };
    let top_up = CyclesTopUp {
        date: runtime_state.env.now(),
        amount: top_up_amount,
    };

    if can_spend_cycles(top_up_amount, MIN_CYCLES_BALANCE) {
        Ok(PrepareResult {
            canister_id,
            top_up,
            is_group,
        })
    } else {
        Err(NotifyLowBalanceResponse::NotEnoughCyclesRemaining)
    }
}

fn commit(canister_id: CanisterId, top_up: CyclesTopUp, is_group: bool, runtime_state: &mut RuntimeState) {
    runtime_state.data.total_cycles_spent_on_canisters += top_up.amount as u128;

    if is_group {
        let chat_id = canister_id.into();
        if let Some(group_chat) = runtime_state.data.public_groups.get_mut(&chat_id) {
            group_chat.mark_cycles_top_up(top_up);
        } else if let Some(group_chat) = runtime_state.data.private_groups.get_mut(&chat_id) {
            group_chat.mark_cycles_top_up(top_up);
        } else {
            panic!("Chat not found. {chat_id:?}");
        }
    } else {
        runtime_state.data.local_index_map.mark_cycles_top_up(canister_id, top_up);
    }
}
