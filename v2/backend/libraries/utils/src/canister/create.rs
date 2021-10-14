use crate::canister;
use candid::{CandidType, Nat, Principal};
use ic_cdk::api;
use serde::Deserialize;
use std::convert::TryInto;
use tracing::error;
use types::{CanisterId, Cycles};

#[derive(Debug)]
pub enum CreateAndInstallError {
    CreateFailed(canister::Error),
    InstallFailed((canister::Error, CanisterId)),
}

pub async fn create_and_install(
    existing_canister_id: Option<CanisterId>,
    wasm_module: Vec<u8>,
    wasm_arg: Vec<u8>,
    cycles_to_use: Cycles,
) -> Result<CanisterId, CreateAndInstallError> {
    let canister_id = match existing_canister_id {
        Some(id) => id,
        None => match create(cycles_to_use).await {
            Err(error) => {
                return Err(CreateAndInstallError::CreateFailed(error));
            }
            Ok(id) => id,
        },
    };

    match install(canister_id, wasm_module, wasm_arg).await {
        Err(error) => Err(CreateAndInstallError::InstallFailed((error, canister_id))),
        Ok(_) => Ok(canister_id),
    }
}

pub async fn create(cycles_to_use: Cycles) -> Result<Principal, canister::Error> {
    #[derive(CandidType, Clone, Deserialize)]
    struct CanisterSettings {
        controller: Option<Principal>,
        compute_allocation: Option<Nat>,
        memory_allocation: Option<Nat>,
        freezing_threshold: Option<Nat>,
    }

    #[derive(CandidType)]
    struct In {
        settings: Option<CanisterSettings>,
    }

    #[derive(CandidType, Deserialize)]
    struct CreateResult {
        canister_id: Principal,
    }

    let in_arg = In {
        settings: Some(CanisterSettings {
            controller: Some(ic_cdk::id()),
            compute_allocation: None,
            memory_allocation: None,
            freezing_threshold: None,
        }),
    };

    let (create_result,): (CreateResult,) = match api::call::call_with_payment(
        Principal::management_canister(),
        "create_canister",
        (in_arg,),
        cycles_to_use.try_into().unwrap(),
    )
    .await
    {
        Ok(x) => x,
        Err((code, msg)) => {
            let code = code as u8;
            error!(
                error_code = code,
                error_message = msg.as_str(),
                "Error calling create_canister"
            );

            return Err(canister::Error { code, msg });
        }
    };

    Ok(create_result.canister_id)
}

pub async fn install(canister_id: CanisterId, wasm_module: Vec<u8>, wasm_arg: Vec<u8>) -> Result<(), canister::Error> {
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
        mode: InstallMode::Install,
        canister_id,
        wasm_module,
        arg: wasm_arg,
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
