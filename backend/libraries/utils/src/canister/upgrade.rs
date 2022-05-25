use crate::canister;
use crate::cycles::top_up_canister;
use candid::{CandidType, Principal};
use ic_cdk::api;
use ic_cdk::api::call::{CallResult, RejectionCode};
use serde::{Deserialize, Serialize};
use tracing::{error, trace};
use types::{CanisterId, CanisterWasm, Cycles, Version};

pub struct CanisterToUpgrade<A: CandidType> {
    pub canister_id: CanisterId,
    pub current_wasm_version: Version,
    pub new_wasm: CanisterWasm,
    pub cycles_to_deposit_if_needed: Option<Cycles>,
    pub args: A,
}

pub async fn upgrade<A: CandidType>(canister_to_upgrade: CanisterToUpgrade<A>) -> Result<Option<Cycles>, canister::Error> {
    #[derive(CandidType, Serialize, Deserialize)]
    struct StartOrStopCanisterArgs {
        canister_id: Principal,
    }

    #[derive(CandidType, Serialize, Deserialize)]
    enum InstallMode {
        #[serde(rename = "install")]
        Install,
        #[serde(rename = "reinstall")]
        Reinstall,
        #[serde(rename = "upgrade")]
        Upgrade,
    }

    #[derive(CandidType, Serialize, Deserialize)]
    struct CanisterInstall {
        mode: InstallMode,
        canister_id: Principal,
        #[serde(with = "serde_bytes")]
        wasm_module: Vec<u8>,
        #[serde(with = "serde_bytes")]
        arg: Vec<u8>,
    }

    let canister_id = canister_to_upgrade.canister_id;
    let canister_id_string = canister_id.to_string();

    trace!(canister_id = canister_id_string.as_str(), "Canister upgrade starting");

    let stop_canister_args = StartOrStopCanisterArgs { canister_id };
    let stop_canister_response: CallResult<()> =
        api::call::call(Principal::management_canister(), "stop_canister", (stop_canister_args,)).await;

    if let Err((code, msg)) = stop_canister_response {
        error!(
            canister_id = canister_id_string.as_str(),
            error_code = code as u8,
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
    let mut install_code_response: CallResult<()> =
        api::call::call(Principal::management_canister(), "install_code", (&install_code_args,)).await;

    let mut cycles_used = None;
    let mut error = None;
    if let Err((code, msg)) = &install_code_response {
        if let Some(cycles) = should_deposit_cycles_and_retry(code, msg, canister_to_upgrade.cycles_to_deposit_if_needed) {
            if top_up_canister(canister_id, cycles).await.is_ok() {
                cycles_used = Some(cycles);
                install_code_response =
                    api::call::call(Principal::management_canister(), "install_code", (&install_code_args,)).await;
            }
        }
    }

    if let Err((code, msg)) = install_code_response {
        error!(
            canister_id = canister_id_string.as_str(),
            from_wasm_version = %canister_to_upgrade.current_wasm_version,
            to_wasm_version = %canister_to_upgrade.new_wasm.version,
            error_code = code as u8,
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
        error!(
            canister_id = canister_id_string.as_str(),
            error_code = code as u8,
            error_message = msg.as_str(),
            "Error calling 'start_canister'"
        );
        error = error.or(Some(canister::Error { code, msg }));
    }

    if let Some(error) = error {
        error!(canister_id = canister_id_string.as_str(), "Canister upgrade failed");
        Err(error)
    } else {
        trace!(canister_id = canister_id_string.as_str(), "Canister upgrade completed");
        Ok(cycles_used)
    }
}

fn should_deposit_cycles_and_retry(
    error_code: &RejectionCode,
    error_message: &str,
    cycles_to_deposit_if_required: Option<Cycles>,
) -> Option<Cycles> {
    if matches!(error_code, RejectionCode::CanisterError) && error_message.contains("out of cycles") {
        cycles_to_deposit_if_required
    } else {
        None
    }
}
