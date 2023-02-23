use crate::{mutate_state, read_state, RuntimeState, BUCKET_CANISTER_TOP_UP_AMOUNT, MIN_CYCLES_BALANCE};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{CanisterId, CyclesTopUp, NotifyLowBalanceResponse};
use utils::canister::deposit_cycles;
use utils::cycles::can_spend_cycles;

#[update]
#[trace]
async fn c2c_notify_low_balance() -> NotifyLowBalanceResponse {
    let prepare_ok = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };
    let amount = prepare_ok.top_up.amount;

    if deposit_cycles(prepare_ok.bucket, amount).await.is_ok() {
        mutate_state(|state| commit(prepare_ok.bucket, prepare_ok.top_up, state));
        NotifyLowBalanceResponse::Success(amount)
    } else {
        NotifyLowBalanceResponse::FailedToDepositCycles
    }
}

struct PrepareResult {
    bucket: CanisterId,
    top_up: CyclesTopUp,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, NotifyLowBalanceResponse> {
    let caller = runtime_state.env.caller();
    let top_up_amount = BUCKET_CANISTER_TOP_UP_AMOUNT;
    let top_up = CyclesTopUp {
        date: runtime_state.env.now(),
        amount: top_up_amount,
    };

    if !can_spend_cycles(top_up_amount, MIN_CYCLES_BALANCE) {
        Err(NotifyLowBalanceResponse::NotEnoughCyclesRemaining)
    } else if runtime_state.data.buckets.get(&caller).is_some() {
        Ok(PrepareResult { bucket: caller, top_up })
    } else {
        panic!("Caller not recognised. {caller}");
    }
}

fn commit(bucket: CanisterId, top_up: CyclesTopUp, runtime_state: &mut RuntimeState) {
    runtime_state.data.total_cycles_spent_on_canisters += top_up.amount;
    if !runtime_state.data.buckets.mark_cycles_top_up(&bucket, top_up) {
        panic!("Bucket not found. {bucket}");
    }
}
