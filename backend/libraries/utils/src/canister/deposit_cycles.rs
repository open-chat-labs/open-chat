use ic_cdk::api::call::CallResult;
use ic_cdk::api::management_canister;
use ic_cdk::api::management_canister::main::CanisterIdRecord;
use tracing::{error, info};
use types::{CanisterId, Cycles};

pub async fn deposit_cycles(canister_id: CanisterId, amount: Cycles) -> CallResult<()> {
    if let Err((code, msg)) = management_canister::main::deposit_cycles(CanisterIdRecord { canister_id }, amount).await {
        error!(
            canister_id = canister_id.to_string().as_str(),
            error_code = code as u8,
            error_message = msg.as_str(),
            "Error calling 'deposit_cycles'"
        );
        Err((code, msg))
    } else {
        info!(
            canister_id = canister_id.to_string().as_str(),
            amount, "Topped up canister with cycles"
        );
        Ok(())
    }
}
