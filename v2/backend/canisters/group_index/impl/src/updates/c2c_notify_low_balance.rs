use crate::{mutate_state, read_state, RuntimeState, GROUP_CANISTER_TOP_UP_AMOUNT, MIN_CYCLES_BALANCE};
use canister_api_macros::trace;
use cycles_utils::{can_spend_cycles, top_up_canister};
use ic_cdk_macros::update;
use types::{ChatId, CyclesTopUp, NotifyLowBalanceResponse};

#[update]
#[trace]
async fn c2c_notify_low_balance() -> NotifyLowBalanceResponse {
    let prepare_ok = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };
    let amount = prepare_ok.top_up.amount;

    if top_up_canister(prepare_ok.chat_id.into(), amount).await.is_ok() {
        mutate_state(|state| commit(prepare_ok.chat_id, prepare_ok.top_up, state));
        NotifyLowBalanceResponse::Success(amount)
    } else {
        NotifyLowBalanceResponse::FailedToDepositCycles
    }
}

struct PrepareResult {
    chat_id: ChatId,
    top_up: CyclesTopUp,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, NotifyLowBalanceResponse> {
    let caller = runtime_state.env.caller();
    let chat_id = caller.into();
    let top_up_amount = GROUP_CANISTER_TOP_UP_AMOUNT;
    let top_up = CyclesTopUp {
        date: runtime_state.env.now(),
        amount: top_up_amount,
    };

    if !can_spend_cycles(top_up_amount, MIN_CYCLES_BALANCE) {
        Err(NotifyLowBalanceResponse::NotEnoughCyclesRemaining)
    } else if runtime_state.data.chat_exists(&chat_id) {
        Ok(PrepareResult { chat_id, top_up })
    } else {
        panic!("Caller not recognised. {}", caller);
    }
}

fn commit(chat_id: ChatId, top_up: CyclesTopUp, runtime_state: &mut RuntimeState) {
    runtime_state.data.total_cycles_spent_on_canisters += top_up.amount as u128;
    if let Some(group_chat) = runtime_state.data.public_groups.get_mut(&chat_id) {
        group_chat.mark_cycles_top_up(top_up);
    } else if let Some(group_chat) = runtime_state.data.private_groups.get_mut(&chat_id) {
        group_chat.mark_cycles_top_up(top_up);
    } else {
        panic!("Chat not found. {:?}", chat_id);
    }
}
