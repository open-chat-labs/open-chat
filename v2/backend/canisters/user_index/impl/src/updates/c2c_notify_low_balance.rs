use crate::{RuntimeState, MIN_CYCLES_BALANCE, RUNTIME_STATE, USER_CANISTER_TOP_UP_AMOUNT};
use cycles_utils::top_up_canister;
use ic_cdk_macros::update;
use tracing::instrument;
use types::{CyclesTopUp, NotifyLowBalanceResponse, UserId};

#[update]
#[instrument(level = "trace")]
async fn c2c_notify_low_balance() -> NotifyLowBalanceResponse {
    let prepare_ok = match RUNTIME_STATE.with(|state| prepare(state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };
    let amount = prepare_ok.top_up.amount;

    if top_up_canister(prepare_ok.user_id.into(), amount).await.is_ok() {
        RUNTIME_STATE.with(|state| commit(prepare_ok.user_id, prepare_ok.top_up, state.borrow_mut().as_mut().unwrap()));
        NotifyLowBalanceResponse::Success(amount)
    } else {
        NotifyLowBalanceResponse::FailedToDepositCycles
    }
}

struct PrepareResult {
    user_id: UserId,
    top_up: CyclesTopUp,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, NotifyLowBalanceResponse> {
    let caller = runtime_state.env.caller();
    let user_id = caller.into();
    let top_up_amount = USER_CANISTER_TOP_UP_AMOUNT;
    let top_up = CyclesTopUp {
        date: runtime_state.env.now(),
        amount: top_up_amount,
    };
    let cycles_balance = runtime_state.env.cycles_balance();
    if cycles_balance - top_up_amount < MIN_CYCLES_BALANCE {
        Err(NotifyLowBalanceResponse::NotEnoughCyclesRemaining)
    } else if runtime_state.data.users.get_by_user_id(&user_id).is_some() {
        Ok(PrepareResult { user_id, top_up })
    } else {
        panic!("Caller not recognised. {}", caller);
    }
}

fn commit(user_id: UserId, top_up: CyclesTopUp, runtime_state: &mut RuntimeState) {
    runtime_state.data.total_cycles_spent_on_canisters += top_up.amount;
    if !runtime_state.data.users.mark_cycles_top_up(&user_id, top_up) {
        panic!("User not found. {:?}", user_id);
    }
}
