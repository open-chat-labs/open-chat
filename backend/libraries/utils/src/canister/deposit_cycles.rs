use crate::canister::convert_cdk_error;
use ic_cdk::management_canister::{self, DepositCyclesArgs};
use tracing::{error, info};
use types::{C2CError, CanisterId, Cycles};

pub async fn deposit_cycles(canister_id: CanisterId, amount: Cycles) -> Result<(), C2CError> {
    if let Err(e) = management_canister::deposit_cycles(&DepositCyclesArgs { canister_id }, amount).await {
        let error = convert_cdk_error(canister_id, "deposit_cycles", e);
        error!(?error, "Error calling 'deposit_cycles'");
        Err(error)
    } else {
        info!(
            %canister_id,
            amount,
            "Topped up canister with cycles"
        );
        Ok(())
    }
}
