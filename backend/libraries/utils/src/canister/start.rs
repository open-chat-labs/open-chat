use crate::canister::convert_cdk_error;
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::{self, StartCanisterArgs};
use tracing::error;
use types::CanisterId;

pub async fn start(canister_id: CanisterId) -> Result<(), (RejectCode, String)> {
    management_canister::start_canister(&StartCanisterArgs { canister_id })
        .await
        .map_err(|error| {
            let (code, msg) = convert_cdk_error(error);
            error!(
                %canister_id,
                error_code = %code,
                error_message = msg.as_str(),
                "Error calling start_canister"
            );
            (code, msg)
        })
}
