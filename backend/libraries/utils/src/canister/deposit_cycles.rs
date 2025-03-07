use crate::canister::convert_cdk_error;
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::{self, DepositCyclesArgs};
use tracing::{error, info};
use types::{CanisterId, Cycles};

pub async fn deposit_cycles(canister_id: CanisterId, amount: Cycles) -> Result<(), (RejectCode, String)> {
    if let Err(error) = management_canister::deposit_cycles(&DepositCyclesArgs { canister_id }, amount).await {
        let (code, msg) = convert_cdk_error(error);
        error!(
            %canister_id,
            error_code = %code,
            error_message = msg.as_str(),
            "Error calling 'deposit_cycles'"
        );
        Err((code, msg))
    } else {
        info!(
            %canister_id,
            amount,
            "Topped up canister with cycles"
        );
        Ok(())
    }
}
