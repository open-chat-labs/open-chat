use crate::guards::caller_is_local_user_canister;
use crate::{mutate_state, read_state, RuntimeState, USER_CANISTER_TOP_UP_AMOUNT};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::{CyclesTopUp, NotifyLowBalanceArgs, NotifyLowBalanceResponse, UserId};
use utils::canister::deposit_cycles;
use utils::consts::MIN_CYCLES_BALANCE;
use utils::cycles::can_spend_cycles;

#[update_msgpack(guard = "caller_is_local_user_canister")]
#[trace]
async fn c2c_notify_low_balance(_args: NotifyLowBalanceArgs) -> NotifyLowBalanceResponse {
    let prepare_ok = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };
    let amount = prepare_ok.top_up.amount;

    if deposit_cycles(prepare_ok.user_id.into(), amount).await.is_ok() {
        mutate_state(|state| commit(prepare_ok.user_id, prepare_ok.top_up, state));
        NotifyLowBalanceResponse::Success(amount)
    } else {
        NotifyLowBalanceResponse::FailedToDepositCycles
    }
}

struct PrepareResult {
    user_id: UserId,
    top_up: CyclesTopUp,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, NotifyLowBalanceResponse> {
    let caller = state.env.caller();
    let user_id = caller.into();
    let top_up_amount = USER_CANISTER_TOP_UP_AMOUNT;
    let top_up = CyclesTopUp {
        date: state.env.now(),
        amount: top_up_amount,
    };

    if can_spend_cycles(top_up_amount, MIN_CYCLES_BALANCE) {
        Ok(PrepareResult { user_id, top_up })
    } else {
        Err(NotifyLowBalanceResponse::NotEnoughCyclesRemaining)
    }
}

fn commit(user_id: UserId, top_up: CyclesTopUp, state: &mut RuntimeState) {
    state.data.total_cycles_spent_on_canisters += top_up.amount;
    if !state.data.local_users.mark_cycles_top_up(&user_id, top_up) {
        panic!("User not found. {user_id:?}");
    }
}
