use ic_cdk::api::call::CallResult;
use ic_cdk::api::management_canister;
use ic_cdk::api::management_canister::main::CanisterIdRecord;
use tracing::error;
use types::CanisterId;

pub async fn start(canister_id: CanisterId) -> CallResult<()> {
    management_canister::main::start_canister(CanisterIdRecord { canister_id })
        .await
        .map_err(|(code, msg)| {
            error!(
                %canister_id,
                error_code = code as u8,
                error_message = msg.as_str(),
                "Error calling start_canister"
            );
            (code, msg)
        })
}
