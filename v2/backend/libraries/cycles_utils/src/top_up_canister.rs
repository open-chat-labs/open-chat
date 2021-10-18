use candid::Principal;
use ic_base_types::PrincipalId;
use ic_cdk::api::call::CallResult;
use std::convert::TryInto;
use types::{CanisterId, Cycles};

pub async fn top_up_canister(canister_id: CanisterId, amount: Cycles) -> CallResult<()> {
    let canister_id = ic_base_types::CanisterId::new(PrincipalId(canister_id)).unwrap();
    let payload = ic_ic00_types::CanisterIdRecord::from(canister_id);

    ic_cdk::api::call::call_with_payment(
        Principal::management_canister(),
        "deposit_cycles",
        (payload,),
        amount.try_into().unwrap(),
    )
    .await
}
