use crate::canister;
use candid::{CandidType, Principal};
use ic_cdk::api;
use ic_cdk::api::call::CallResult;
use serde::Deserialize;
use tracing::error;
use types::{CanisterId, CanisterWasm, Version};

pub struct CanisterToUpgrade<A: CandidType> {
    pub canister_id: CanisterId,
    pub current_wasm_version: Version,
    pub new_wasm: CanisterWasm,
    pub args: A,
}

pub async fn upgrade<A: CandidType>(canister_to_upgrade: CanisterToUpgrade<A>) -> Result<(), canister::Error> {
    #[derive(CandidType, Deserialize)]
    struct StartOrStopCanisterArgs {
        canister_id: Principal,
    }

    #[derive(CandidType, Deserialize)]
    enum InstallMode {
        #[serde(rename = "install")]
        Install,
        #[serde(rename = "reinstall")]
        Reinstall,
        #[serde(rename = "upgrade")]
        Upgrade,
    }

    #[derive(CandidType, Deserialize)]
    struct CanisterInstall {
        mode: InstallMode,
        canister_id: Principal,
        #[serde(with = "serde_bytes")]
        wasm_module: Vec<u8>,
        #[serde(with = "serde_bytes")]
        arg: Vec<u8>,
    }

    let canister_id = canister_to_upgrade.canister_id;
    let stop_canister_args = StartOrStopCanisterArgs { canister_id };
    let stop_canister_response: CallResult<()> =
        api::call::call(Principal::management_canister(), "stop_canister", (stop_canister_args,)).await;

    if let Err((code, msg)) = stop_canister_response {
        let code = code as u8;
        error!(
            canister_id = canister_id.to_string().as_str(),
            error_code = code,
            error_message = msg.as_str(),
            "Error calling 'stop_canister'"
        );
        return Err(canister::Error { code, msg });
    }

    let install_code_args = CanisterInstall {
        mode: InstallMode::Upgrade,
        canister_id,
        wasm_module: canister_to_upgrade.new_wasm.module,
        arg: candid::encode_one(canister_to_upgrade.args).unwrap(),
    };
    let install_code_response: CallResult<()> =
        api::call::call(Principal::management_canister(), "install_code", (install_code_args,)).await;

    let mut error = None;
    if let Err((code, msg)) = install_code_response {
        let code = code as u8;
        error!(
            canister_id = canister_id.to_string().as_str(),
            from_wasm_version = %canister_to_upgrade.current_wasm_version,
            to_wasm_version = %canister_to_upgrade.new_wasm.version,
            error_code = code,
            error_message = msg.as_str(),
            "Error calling 'install_code'"
        );
        error = Some(canister::Error { code, msg });
    }

    // Call 'start canister' regardless of if 'install_code' succeeded or not.
    let start_canister_args = StartOrStopCanisterArgs { canister_id };
    let start_canister_response: CallResult<()> =
        api::call::call(Principal::management_canister(), "start_canister", (start_canister_args,)).await;

    if let Err((code, msg)) = start_canister_response {
        let code = code as u8;
        error!(
            canister_id = canister_id.to_string().as_str(),
            error_code = code,
            error_message = msg.as_str(),
            "Error calling 'start_canister'"
        );
        error = error.or(Some(canister::Error { code, msg }));
    }

    match error {
        None => Ok(()),
        Some(e) => Err(e),
    }
}
