use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk::api::management_canister;
use ic_cdk::api::management_canister::main::{CanisterIdRecord, CanisterStatusType};
use tracing::{error, trace};
use types::CanisterId;

pub async fn stop(canister_id: CanisterId) -> CallResult<()> {
    if let Err((code, msg)) = management_canister::main::stop_canister(CanisterIdRecord { canister_id }).await {
        error!(
            %canister_id,
            error_code = code as u8,
            error_message = msg.as_str(),
            "Error calling stop_canister"
        );
        return Err((code, msg));
    }

    let mut iterations = 0;
    let mut failures = 0;
    loop {
        match management_canister::main::canister_status(CanisterIdRecord { canister_id }).await {
            Ok((response,)) => {
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
            Err((code, msg)) => {
                error!(
                    %canister_id,
                    error_code = code as u8,
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
            return Err((RejectionCode::Unknown, "Failed to wait for canister to stop".to_string()));
        }
    }
}
