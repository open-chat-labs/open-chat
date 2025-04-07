use crate::canister::convert_cdk_error;
use ic_cdk::management_canister::DeleteCanisterArgs;
use tracing::error;
use types::{C2CError, CanisterId};

pub async fn delete(canister_id: CanisterId) -> Result<(), C2CError> {
    ic_cdk::management_canister::delete_canister(&DeleteCanisterArgs { canister_id })
        .await
        .map_err(|e| {
            let error = convert_cdk_error(canister_id, "delete_canister", e);
            error!(?error, "Error calling delete_canister");
            error
        })
}
