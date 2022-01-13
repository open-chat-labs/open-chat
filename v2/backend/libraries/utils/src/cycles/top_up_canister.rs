use candid::{CandidType, Principal};
use ic_cdk::api::call::CallResult;
use std::convert::TryInto;
use tracing::error;
use types::{CanisterId, Cycles};

pub async fn top_up_canister(canister_id: CanisterId, amount: Cycles) -> CallResult<()> {
    let payload = CanisterIdRecord { canister_id };

    let response: CallResult<()> = ic_cdk::api::call::call_with_payment(
        Principal::management_canister(),
        "deposit_cycles",
        (payload,),
        amount.try_into().unwrap(),
    )
    .await;

    if let Err((code, msg)) = response {
        error!(
            canister_id = canister_id.to_string().as_str(),
            error_code = code as u8,
            error_message = msg.as_str(),
            "Error calling 'deposit_cycles'"
        );
        Err((code, msg))
    } else {
        Ok(())
    }
}

#[derive(CandidType, Debug)]
pub struct CanisterIdRecord {
    canister_id: CanisterId,
}
