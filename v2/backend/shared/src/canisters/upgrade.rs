use crate::canisters::error::Error;
use crate::types::CanisterId;
use candid::{CandidType, Principal};
use ic_cdk::api;
use log::error;
use serde::Deserialize;

pub async fn call(canister_id: CanisterId, wasm_module: Vec<u8>) -> Result<(), Error> {
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
            error!("Error calling install_code: {}: {}", code, msg);
            return Err(Error { code, msg });
        }
    };

    Ok(())
}
