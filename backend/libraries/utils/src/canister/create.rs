use candid::Principal;
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk::api::management_canister;
use ic_cdk::api::management_canister::main::{
    CanisterInstallMode, CanisterSettings, CreateCanisterArgument, InstallCodeArgument,
};
use tracing::error;
use types::{CanisterId, Cycles};

#[derive(Debug)]
pub enum CreateAndInstallError {
    CreateFailed(RejectionCode, String),
    InstallFailed(CanisterId, RejectionCode, String),
}

pub async fn create_and_install(
    existing_canister_id: Option<CanisterId>,
    wasm_module: Vec<u8>,
    wasm_arg: Vec<u8>,
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

    match install(canister_id, wasm_module, wasm_arg).await {
        Ok(_) => Ok(canister_id),
        Err((code, msg)) => Err(CreateAndInstallError::InstallFailed(canister_id, code, msg)),
    }
}

pub async fn create(cycles_to_use: Cycles) -> CallResult<Principal> {
    match management_canister::main::create_canister_with_extra_cycles(
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

pub async fn install(canister_id: CanisterId, wasm_module: Vec<u8>, wasm_arg: Vec<u8>) -> CallResult<()> {
    management_canister::main::install_code(InstallCodeArgument {
        mode: CanisterInstallMode::Install,
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
