use crate::canister::convert_cdk_error;
use ic_cdk_management_canister::{self as management_canister, CanisterInfoArgs, CanisterInfoResult};
use types::{C2CError, CanisterId};

// Unlike `canister_status`, any canister may call this, not just the target's controllers
pub async fn canister_info(canister_id: CanisterId) -> Result<CanisterInfoResult, C2CError> {
    management_canister::canister_info(&CanisterInfoArgs {
        canister_id,
        num_requested_changes: None,
    })
    .await
    .map_err(|e| convert_cdk_error(canister_id, "canister_info", e))
}
