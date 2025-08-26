use crate::canister::convert_cdk_error;
use ic_cdk::management_canister::StartCanisterArgs;
use tracing::error;
use types::{C2CError, CanisterId};

pub async fn start(canister_id: CanisterId) -> Result<(), C2CError> {
    ic_cdk::management_canister::start_canister(&StartCanisterArgs { canister_id })
        .await
        .map_err(|e| {
            let error = convert_cdk_error(canister_id, "start_canister", e);
            error!(?error, "Error calling start_canister");
            error
        })
}
