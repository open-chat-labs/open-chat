use crate::canister::convert_cdk_error;
use ic_cdk::management_canister::{self, UninstallCodeArgs};
use tracing::error;
use types::{C2CError, CanisterId};

pub async fn uninstall(canister_id: CanisterId) -> Result<(), C2CError> {
    management_canister::uninstall_code(&UninstallCodeArgs { canister_id })
        .await
        .map_err(|e| {
            let error = convert_cdk_error(canister_id, "uninstall_code", e);
            error!(?error, "Error calling uninstall_code");
            error
        })
}
