use ic_cdk::api::call::CallResult;
use std::convert::TryInto;
use types::{CanisterId, Cycles};

pub async fn top_up_canister(canister_id: CanisterId, amount: Cycles) -> CallResult<()> {
    ic_cdk::api::call::call_with_payment(canister_id, "deposit_cycles", (), amount.try_into().unwrap()).await
}
