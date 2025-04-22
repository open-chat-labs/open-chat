use crate::{BUCKET_CANISTER_TOP_UP_AMOUNT, MIN_CYCLES_BALANCE, RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use storage_index_canister::c2c_notify_low_balance::*;
use types::{CanisterId, CyclesTopUp};
use utils::canister::deposit_cycles;
use utils::cycles::can_spend_cycles;

#[update(msgpack = true)]
#[trace]
async fn c2c_notify_low_balance(_args: Args) -> Response {
    top_up_cycles(None).await
}

pub(crate) async fn top_up_cycles(bucket: Option<CanisterId>) -> Response {
    let prepare_ok = match read_state(|state| prepare(state, bucket)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };
    let amount = prepare_ok.top_up.amount;

    if deposit_cycles(prepare_ok.bucket, amount).await.is_ok() {
        mutate_state(|state| commit(prepare_ok.bucket, prepare_ok.top_up, state));
        Response::Success(amount)
    } else {
        Response::FailedToDepositCycles
    }
}

struct PrepareResult {
    bucket: CanisterId,
    top_up: CyclesTopUp,
}

fn prepare(state: &RuntimeState, bucket: Option<CanisterId>) -> Result<PrepareResult, Response> {
    let bucket = bucket.unwrap_or_else(|| state.env.caller());
    let top_up_amount = BUCKET_CANISTER_TOP_UP_AMOUNT;
    let top_up = CyclesTopUp {
        date: state.env.now(),
        amount: top_up_amount,
    };

    if !can_spend_cycles(top_up_amount, MIN_CYCLES_BALANCE) {
        Err(Response::NotEnoughCyclesRemaining)
    } else if state.data.buckets.get(&bucket).is_some() {
        Ok(PrepareResult { bucket, top_up })
    } else {
        panic!("Bucket not recognised. {bucket}");
    }
}

fn commit(bucket: CanisterId, top_up: CyclesTopUp, state: &mut RuntimeState) {
    state.data.total_cycles_spent_on_canisters += top_up.amount;
    if !state.data.buckets.mark_cycles_top_up(&bucket, top_up) {
        panic!("Bucket not found. {bucket}");
    }
}
