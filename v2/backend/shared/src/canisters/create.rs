use crate::canisters::error::Error;
use crate::types::CanisterId;
use ic_cdk::api;
use candid::{CandidType, Nat, Principal};
use log::error;
use serde::Deserialize;

#[derive(Debug)]
pub enum CreateCanisterError {
    CreateFailed(Error),
    InstallFailed((Error, CanisterId)),
}

pub async fn call(
    existing_canister_id: Option<CanisterId>,
    wasm_module: Vec<u8>,
    wasm_arg: Vec<u8>,
    cycles_to_use: u64,
) -> Result<CanisterId, CreateCanisterError> {
    let canister_id = match existing_canister_id {
        Some(id) => id,
        None => match create(cycles_to_use).await {
            Err(error) => {
                error!("Error calling create_canister: {}: {}", error.code, error.msg);
                return Err(CreateCanisterError::CreateFailed(error));
            }
            Ok(id) => id,
        },
    };

    match install(canister_id, wasm_module, wasm_arg).await {
        Err(error) => {
            error!("Error calling install_code: {}: {}", error.code, error.msg);
            Err(CreateCanisterError::InstallFailed((error, canister_id)))
        }
        Ok(_) => Ok(canister_id),
    }
}

async fn create(cycles_to_use: u64) -> Result<Principal, Error> {
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

    let (create_result,): (CreateResult,) =
        match api::call::call_with_payment(Principal::management_canister(), "create_canister", (in_arg,), cycles_to_use).await
        {
            Ok(x) => x,
            Err((code, msg)) => {
                return Err(Error { code: code as u8, msg });
            }
        };

    Ok(create_result.canister_id)
}

async fn install(canister_id: CanisterId, wasm_module: Vec<u8>, wasm_arg: Vec<u8>) -> Result<(), Error> {
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
            return Err(Error { code: code as u8, msg });
        }
    };

    Ok(())
}
