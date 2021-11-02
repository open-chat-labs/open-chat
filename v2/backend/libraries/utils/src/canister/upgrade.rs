use crate::canister;
use candid::{CandidType, Principal};
use ic_cdk::api;
use serde::Deserialize;
use tracing::error;
use types::{CanisterId, CanisterWasm, Version};

pub struct CanisterToUpgrade {
    pub canister_id: CanisterId,
    pub current_wasm_version: Version,
    pub new_wasm: CanisterWasm,
}

pub async fn upgrade(canister_id: CanisterId, wasm_module: Vec<u8>) -> Result<(), canister::Error> {
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

    let install_config = CanisterInstall {
        mode: InstallMode::Upgrade,
        canister_id,
        wasm_module,
        arg: b" ".to_vec(),
    };

    let (_,): ((),) = match api::call::call(Principal::management_canister(), "install_code", (install_config,)).await {
        Ok(x) => x,
        Err((code, msg)) => {
            let code = code as u8;
            error!(error_code = code, error_message = msg.as_str(), "Error calling install_code");
            return Err(canister::Error { code, msg });
        }
    };

    Ok(())
}
