use crate::canister::convert_cdk_error;
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::{CanisterStatusArgs, CanisterStatusType, StopCanisterArgs};
use tracing::{error, trace};
use types::CanisterId;

pub async fn stop(canister_id: CanisterId) -> Result<(), (RejectCode, String)> {
    if let Err(error) = ic_cdk::management_canister::stop_canister(&StopCanisterArgs { canister_id }).await {
        let (code, msg) = convert_cdk_error(error);
        error!(
            %canister_id,
            error_code = %code,
            error_message = msg.as_str(),
            "Error calling stop_canister"
        );
        return Err((code, msg));
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
            Err(error) => {
                let (code, msg) = convert_cdk_error(error);
                error!(
                    %canister_id,
                    error_code = %code,
                    error_message = msg.as_str(),
                    "Error calling canister_status"
                );

                failures += 1;
                if failures >= 3 {
                    return Err((code, msg));
                }
            }
        }
        iterations += 1;
        if iterations >= 10 {
            error!(%canister_id, iterations, "Failed to wait for canister to stop");
            return Err((RejectCode::SysUnknown, "Failed to wait for canister to stop".to_string()));
        }
    }
}
