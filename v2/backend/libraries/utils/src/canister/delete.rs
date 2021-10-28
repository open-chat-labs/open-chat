use crate::canister;
use candid::{CandidType, Principal};
use ic_cdk::api;
use serde::Deserialize;
use tracing::error;
use types::CanisterId;

pub async fn delete(canister_id: CanisterId) -> Result<(), canister::Error> {
    #[derive(CandidType, Deserialize)]
    struct DeleteArgs {
        canister_id: Principal,
    }

    let delete_args = DeleteArgs { canister_id };

    let (_,): ((),) = match api::call::call(Principal::management_canister(), "delete_canister", (delete_args,)).await {
        Ok(x) => x,
        Err((code, msg)) => {
            let code = code as u8;
            error!(
                error_code = code,
                error_message = msg.as_str(),
                "Error calling delete_canister"
            );
            return Err(canister::Error { code, msg });
        }
    };

    Ok(())
}
