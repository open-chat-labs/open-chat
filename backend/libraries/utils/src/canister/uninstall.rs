use crate::canister::convert_cdk_error;
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::{self, UninstallCodeArgs};
use tracing::error;
use types::CanisterId;

pub async fn uninstall(canister_id: CanisterId) -> Result<(), (RejectCode, String)> {
    management_canister::uninstall_code(&UninstallCodeArgs { canister_id })
        .await
        .map_err(|error| {
            let (code, msg) = convert_cdk_error(error);
            error!(
                %canister_id,
                error_code = %code,
                error_message = msg.as_str(),
                "Error calling uninstall_code"
            );
            (code, msg)
        })
}
