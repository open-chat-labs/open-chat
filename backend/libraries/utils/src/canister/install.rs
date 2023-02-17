use crate::canister;
use crate::consts::CYCLES_REQUIRED_FOR_UPGRADE;
use candid::CandidType;
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk::api::management_canister;
use ic_cdk::api::management_canister::main::{CanisterInstallMode, InstallCodeArgument};
use tracing::{error, trace};
use types::{CanisterId, CanisterWasm, Cycles, Version};

pub struct CanisterToInstall<A: CandidType> {
    pub canister_id: CanisterId,
    pub current_wasm_version: Version,
    pub new_wasm: CanisterWasm,
    pub deposit_cycles_if_needed: bool,
    pub args: A,
    pub mode: CanisterInstallMode,
    pub stop_start_canister: bool,
}

pub async fn install<A: CandidType>(canister_to_install: CanisterToInstall<A>) -> CallResult<Option<Cycles>> {
    let canister_id = canister_to_install.canister_id;
    let mode = canister_to_install.mode;

    trace!(%canister_id, ?mode, "Canister install starting");

    if canister_to_install.stop_start_canister {
        canister::stop(canister_id).await?;
    }

    let install_code_args = InstallCodeArgument {
        mode,
        canister_id,
        wasm_module: canister_to_install.new_wasm.module,
        arg: candid::encode_one(canister_to_install.args).unwrap(),
    };
    let mut install_code_response: CallResult<()> = management_canister::main::install_code(install_code_args.clone()).await;

    let mut cycles_used = None;
    let mut error = None;
    let mut attempt = 0;
    while let ShouldDepositAndRetry::Yes(cycles) =
        should_deposit_cycles_and_retry(&install_code_response, canister_to_install.deposit_cycles_if_needed, attempt)
    {
        if canister::deposit_cycles(canister_id, cycles).await.is_ok() {
            cycles_used = Some(cycles_used.unwrap_or_default() + cycles);
            install_code_response = management_canister::main::install_code(install_code_args.clone()).await;
        } else {
            break;
        }
        attempt += 1;
    }

    if let Err((code, msg)) = install_code_response {
        error!(
            %canister_id,
            ?mode,
            from_wasm_version = %canister_to_install.current_wasm_version,
            to_wasm_version = %canister_to_install.new_wasm.version,
            error_code = code as u8,
            error_message = msg.as_str(),
            "Error calling 'install_code'"
        );
        error = Some((code, msg));
    }

    if canister_to_install.stop_start_canister {
        // Call 'start canister' regardless of if 'install_code' succeeded or not.
        if let Err((code, msg)) = canister::start(canister_id).await {
            error = error.or(Some((code, msg)));
        }
    }

    if let Some(error) = error {
        error!(%canister_id, ?mode, "Canister install failed");
        Err(error)
    } else {
        trace!(%canister_id, ?mode, "Canister install completed");
        Ok(cycles_used)
    }
}

enum ShouldDepositAndRetry {
    Yes(Cycles),
    No,
}

fn should_deposit_cycles_and_retry(
    response: &CallResult<()>,
    deposit_cycles_if_needed: bool,
    attempt: usize,
) -> ShouldDepositAndRetry {
    if !deposit_cycles_if_needed || attempt > 5 {
        return ShouldDepositAndRetry::No;
    }

    if let Err((code, msg)) = response {
        if matches!(code, RejectionCode::CanisterError) && msg.contains("out of cycles") {
            return ShouldDepositAndRetry::Yes(CYCLES_REQUIRED_FOR_UPGRADE);
        }
    }
    ShouldDepositAndRetry::No
}
