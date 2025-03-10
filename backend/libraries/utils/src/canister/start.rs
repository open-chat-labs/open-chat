use crate::canister::convert_cdk_error;
use candid::Principal;
use ic_cdk::call::{Call, CallResult, RejectCode};
use ic_cdk::management_canister::{StartCanisterArgs, StopCanisterArgs};
use tracing::error;
use types::CanisterId;

pub async fn start(canister_id: CanisterId) -> Result<(), (RejectCode, String)> {
    start_canister(&StartCanisterArgs { canister_id }).await.map_err(|error| {
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

// Copied from CDK but modified to use `unbounded_wait`
async fn start_canister(arg: &StartCanisterArgs) -> CallResult<()> {
    Ok(Call::unbounded_wait(Principal::management_canister(), "start_canister")
        .with_arg(arg)
        .await?
        .candid()?)
}
