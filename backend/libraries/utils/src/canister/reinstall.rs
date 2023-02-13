use ic_cdk::api::call::CallResult;
use ic_cdk::api::management_canister;
use ic_cdk::api::management_canister::main::{CanisterInstallMode, InstallCodeArgument};
use tracing::error;
use types::CanisterId;

pub async fn reinstall(canister_id: CanisterId, wasm_module: Vec<u8>, wasm_arg: Vec<u8>) -> CallResult<()> {
    management_canister::main::install_code(InstallCodeArgument {
        mode: CanisterInstallMode::Reinstall,
        canister_id,
        wasm_module,
        arg: wasm_arg,
        unsafe_drop_stable_memory: None,
    })
    .await
    .map_err(|(code, msg)| {
        error!(
            %canister_id,
            error_code = code as u8,
            error_message = msg.as_str(),
            "Error calling install_code"
        );
        (code, msg)
    })
}
