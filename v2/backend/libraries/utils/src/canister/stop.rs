use crate::canister;
use candid::{CandidType, Principal};
use ic_cdk::api;
use serde::Deserialize;
use tracing::error;
use types::CanisterId;

pub async fn stop(canister_id: CanisterId) -> Result<(), canister::Error> {
    #[derive(CandidType, Deserialize)]
    struct StopArgs {
        canister_id: Principal,
    }

    let stop_args = StopArgs { canister_id };

    let (_,): ((),) = match api::call::call(Principal::management_canister(), "stop_canister", (stop_args,)).await {
        Ok(x) => x,
        Err((code, msg)) => {
            let code = code as u8;
            error!(error_code = code, error_message = msg.as_str(), "Error calling stop_canister");
            return Err(canister::Error { code, msg });
        }
    };

    Ok(())
}
