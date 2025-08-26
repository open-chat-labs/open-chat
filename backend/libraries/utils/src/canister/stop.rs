use crate::canister::convert_cdk_error;
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::{CanisterStatusArgs, CanisterStatusType, StopCanisterArgs};
use tracing::{error, trace};
use types::{C2CError, CanisterId};

pub async fn stop(canister_id: CanisterId) -> Result<(), C2CError> {
    if let Err(e) = ic_cdk::management_canister::stop_canister(&StopCanisterArgs { canister_id }).await {
        let error = convert_cdk_error(canister_id, "stop_canister", e);
        error!(?error, "Error calling stop_canister");
        return Err(error);
    }

    let mut iterations = 0;
    let mut failures = 0;
    loop {
        match ic_cdk::management_canister::canister_status(&CanisterStatusArgs { canister_id }).await {
            Ok(response) => {
                let status = response.status;
                if status == CanisterStatusType::Stopped {
                    return Ok(());
                }
                trace!(
                    %canister_id,
                    ?status,
                    "Waiting for canister to stop",
                );
            }
            Err(e) => {
                let error = convert_cdk_error(canister_id, "canister_status", e);
                error!(?error, "Error calling canister_status");

                failures += 1;
                if failures >= 3 {
                    return Err(error);
                }
            }
        }
        iterations += 1;
        if iterations >= 10 {
            error!(%canister_id, iterations, "Failed to wait for canister to stop");
            return Err(C2CError::new(
                CanisterId::management_canister(),
                "stop_canister",
                RejectCode::SysUnknown,
                "Failed to wait for canister to stop".to_string(),
            ));
        }
    }
}
