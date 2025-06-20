use crate::canister;
use crate::canister::{convert_cdk_error, is_out_of_cycles_error};
use candid::CandidType;
use constants::CYCLES_REQUIRED_FOR_UPGRADE;
use ic_cdk::management_canister::{self, CanisterInstallMode, ChunkHash};
use tracing::{error, trace};
use types::{BuildVersion, C2CError, CanisterId, CanisterWasm, CanisterWasmBytes, Cycles, Hash};

pub struct CanisterToInstall {
    pub canister_id: CanisterId,
    pub current_wasm_version: BuildVersion,
    pub new_wasm_version: BuildVersion,
    pub new_wasm: WasmToInstall,
    pub deposit_cycles_if_needed: bool,
    pub args: Vec<u8>,
    pub mode: CanisterInstallMode,
    pub stop_start_canister: bool,
}

pub enum WasmToInstall {
    Default(CanisterWasmBytes),
    Chunked(ChunkedWasmToInstall),
}

pub struct ChunkedWasmToInstall {
    pub chunks: Vec<Hash>,
    pub wasm_hash: Hash,
    pub store_canister_id: CanisterId,
}

pub async fn install_basic<A: CandidType>(canister_id: CanisterId, wasm: CanisterWasm, init_args: A) -> Result<(), C2CError> {
    install_basic_raw(canister_id, wasm, candid::encode_one(init_args).unwrap())
        .await
        .map(|_| ())
}

pub async fn install_basic_raw(canister_id: CanisterId, wasm: CanisterWasm, init_args: Vec<u8>) -> Result<(), C2CError> {
    install(CanisterToInstall {
        canister_id,
        current_wasm_version: BuildVersion::default(),
        new_wasm_version: wasm.version,
        new_wasm: WasmToInstall::Default(wasm.module),
        deposit_cycles_if_needed: true,
        args: init_args,
        mode: CanisterInstallMode::Reinstall,
        stop_start_canister: false,
    })
    .await
    .map(|_| ())
}

pub async fn install(canister_to_install: CanisterToInstall) -> Result<Option<Cycles>, C2CError> {
    let canister_id = canister_to_install.canister_id;
    let mode = canister_to_install.mode;

    trace!(%canister_id, ?mode, "Canister install starting");

    if canister_to_install.stop_start_canister {
        canister::stop(canister_id).await?;
    }

    let install_code_args = match canister_to_install.new_wasm {
        WasmToInstall::Default(wasm_module) => InstallCodeArgs::Default(management_canister::InstallCodeArgs {
            mode,
            canister_id,
            wasm_module: wasm_module.into(),
            arg: canister_to_install.args,
        }),
        WasmToInstall::Chunked(wasm) => InstallCodeArgs::Chunked(management_canister::InstallChunkedCodeArgs {
            mode,
            target_canister: canister_id,
            store_canister: Some(wasm.store_canister_id),
            chunk_hashes_list: wasm
                .chunks
                .into_iter()
                .map(|hash| ChunkHash { hash: hash.to_vec() })
                .collect(),
            wasm_module_hash: wasm.wasm_hash.to_vec(),
            arg: canister_to_install.args,
        }),
    };

    let mut install_code_response = install_code_args.clone().install().await;
    let mut cycles_used = None;
    let mut install_error = None;
    let mut attempt = 0;
    while let ShouldDepositAndRetry::Yes(cycles) =
        should_deposit_cycles_and_retry(&install_code_response, canister_to_install.deposit_cycles_if_needed, attempt)
    {
        if canister::deposit_cycles(canister_id, cycles).await.is_ok() {
            cycles_used = Some(cycles_used.unwrap_or_default() + cycles);
            install_code_response = install_code_args.clone().install().await;
        } else {
            break;
        }
        attempt += 1;
    }

    if let Err(error) = install_code_response {
        error!(
            ?error,
            ?mode,
            from_wasm_version = %canister_to_install.current_wasm_version,
            to_wasm_version = %canister_to_install.new_wasm_version,
            "Error calling 'install_code'"
        );
        install_error = Some(error);
    }

    if canister_to_install.stop_start_canister {
        // Call 'start canister' regardless of if 'install_code' succeeded or not.
        if let Err(e) = canister::start(canister_id).await {
            install_error = install_error.or(Some(e));
        }
    }

    if let Some(error) = install_error {
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
    response: &Result<(), C2CError>,
    deposit_cycles_if_needed: bool,
    attempt: usize,
) -> ShouldDepositAndRetry {
    if !deposit_cycles_if_needed || attempt > 5 {
        return ShouldDepositAndRetry::No;
    }

    if let Err(error) = response {
        if is_out_of_cycles_error(error.reject_code(), error.message()) {
            return ShouldDepositAndRetry::Yes(CYCLES_REQUIRED_FOR_UPGRADE / 2);
        }
    }
    ShouldDepositAndRetry::No
}

#[derive(Clone)]
enum InstallCodeArgs {
    Default(management_canister::InstallCodeArgs),
    Chunked(management_canister::InstallChunkedCodeArgs),
}

impl InstallCodeArgs {
    async fn install(&self) -> Result<(), C2CError> {
        let (result, method_name) = match self {
            InstallCodeArgs::Default(args) => (management_canister::install_code(args).await, "install_code"),
            InstallCodeArgs::Chunked(args) => (management_canister::install_chunked_code(args).await, "install_chunked_code"),
        };

        result.map_err(|e| convert_cdk_error(CanisterId::management_canister(), method_name, e))
    }
}
