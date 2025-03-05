use crate::canister::convert_cdk_error;
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::DeleteCanisterArgs;
use tracing::error;
use types::CanisterId;

pub async fn delete(canister_id: CanisterId) -> Result<(), (RejectCode, String)> {
    ic_cdk::management_canister::delete_canister(&DeleteCanisterArgs { canister_id })
        .await
        .map_err(|error| {
            let (code, msg) = convert_cdk_error(error);
            error!(
                %canister_id,
                error_code = %code,
                error_message = msg.as_str(),
                "Error calling delete_canister"
            );
            (code, msg)
        })
}
