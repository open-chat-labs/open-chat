use crate::canister::{install, CanisterToInstall};
use candid::{CandidType, Principal};
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk::api::management_canister;
use ic_cdk::api::management_canister::main::{CanisterInstallMode, CanisterSettings, CreateCanisterArgument};
use tracing::error;
use types::{CanisterId, CanisterWasm, Cycles, Version};

#[derive(Debug)]
pub enum CreateAndInstallError {
    CreateFailed(RejectionCode, String),
    InstallFailed(CanisterId, RejectionCode, String),
}

pub async fn create_and_install<A: CandidType>(
    existing_canister_id: Option<CanisterId>,
    wasm: CanisterWasm,
    init_args: A,
    cycles_to_use: Cycles,
    on_canister_created: fn(Cycles) -> (),
) -> Result<CanisterId, CreateAndInstallError> {
    let canister_id = match existing_canister_id {
        Some(id) => id,
        None => match create(cycles_to_use).await {
            Err((code, msg)) => {
                return Err(CreateAndInstallError::CreateFailed(code, msg));
            }
            Ok(id) => {
                on_canister_created(cycles_to_use);
                id
            }
        },
    };

    match install(CanisterToInstall {
        canister_id,
        current_wasm_version: Version::default(),
        new_wasm: wasm,
        deposit_cycles_if_needed: true,
        args: init_args,
        mode: CanisterInstallMode::Install,
        stop_start_canister: false,
    })
    .await
    {
        Ok(_) => Ok(canister_id),
        Err((code, msg)) => Err(CreateAndInstallError::InstallFailed(canister_id, code, msg)),
    }
}

pub async fn create(cycles_to_use: Cycles) -> CallResult<Principal> {
    match management_canister::main::create_canister(
        CreateCanisterArgument {
            settings: Some(CanisterSettings {
                controllers: Some(vec![ic_cdk::id()]),
                ..Default::default()
            }),
        },
        cycles_to_use,
    )
    .await
    {
        Ok((x,)) => Ok(x.canister_id),
        Err((code, msg)) => {
            error!(
                error_code = code as u8,
                error_message = msg.as_str(),
                "Error calling create_canister"
            );

            Err((code, msg))
        }
    }
}
