use crate::canister;
use candid::{CandidType, Principal};
use ic_cdk::api;
use serde::{Deserialize, Serialize};
use tracing::error;
use types::CanisterId;

pub async fn stop(canister_id: CanisterId) -> Result<(), canister::Error> {
    #[derive(CandidType, Serialize, Deserialize)]
    struct StopArgs {
        canister_id: Principal,
    }

    let stop_args = StopArgs { canister_id };

    if let Err((code, msg)) = api::call::call::<_, ()>(Principal::management_canister(), "stop_canister", (stop_args,)).await {
        error!(
            error_code = code as u8,
            error_message = msg.as_str(),
            "Error calling stop_canister"
        );
        return Err(canister::Error { code, msg });
    };

    Ok(())
}
