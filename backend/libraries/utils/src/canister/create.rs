use crate::canister::{convert_cdk_error, install_basic};
use candid::{CandidType, Principal};
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::{self, CanisterSettings, CreateCanisterArgs};
use tracing::error;
use types::{CanisterId, CanisterWasm, Cycles};

#[derive(Debug)]
pub enum CreateAndInstallError {
    CreateFailed(RejectCode, String),
    InstallFailed(CanisterId, RejectCode, String),
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

    match install_basic(canister_id, wasm, init_args).await {
        Ok(_) => Ok(canister_id),
        Err((code, msg)) => Err(CreateAndInstallError::InstallFailed(canister_id, code, msg)),
    }
}

pub async fn create(cycles_to_use: Cycles) -> Result<Principal, (RejectCode, String)> {
    match management_canister::create_canister_with_cycles(
        &CreateCanisterArgs {
            settings: Some(CanisterSettings {
                controllers: Some(vec![ic_cdk::api::canister_self()]),
                ..Default::default()
            }),
        },
        cycles_to_use,
    )
    .await
    {
        Ok(x) => Ok(x.canister_id),
        Err(error) => {
            let (code, msg) = convert_cdk_error(error);
            error!(
                error_code = %code,
                error_message = msg.as_str(),
                "Error calling create_canister"
            );

            Err((code, msg))
        }
    }
}
