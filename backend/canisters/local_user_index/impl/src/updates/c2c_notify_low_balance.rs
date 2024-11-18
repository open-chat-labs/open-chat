use crate::guards::caller_is_local_user_canister;
use crate::{mutate_state, read_state, RuntimeState, USER_CANISTER_TOP_UP_AMOUNT};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{Cycles, CyclesTopUp, NotifyLowBalanceArgs, NotifyLowBalanceResponse, UserId};
use utils::canister::deposit_cycles;
use utils::consts::min_cycles_balance;
use utils::cycles::can_spend_cycles;

#[update(guard = "caller_is_local_user_canister", msgpack = true)]
#[trace]
async fn c2c_notify_low_balance(_args: NotifyLowBalanceArgs) -> NotifyLowBalanceResponse {
    top_up_user(None).await
}

pub(crate) async fn top_up_user(user_id: Option<UserId>) -> NotifyLowBalanceResponse {
    let prepare_ok = match read_state(|state| prepare(user_id, USER_CANISTER_TOP_UP_AMOUNT, state)) {
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

fn prepare(user_id: Option<UserId>, amount: Cycles, state: &RuntimeState) -> Result<PrepareResult, NotifyLowBalanceResponse> {
    let user_id = user_id.unwrap_or_else(|| state.env.caller().into());
    let top_up = CyclesTopUp {
        date: state.env.now(),
        amount,
    };

    if can_spend_cycles(amount, min_cycles_balance(state.data.test_mode)) {
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
