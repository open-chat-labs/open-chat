use crate::canister;
use crate::consts::CYCLES_REQUIRED_FOR_UPGRADE;
use candid::CandidType;
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk::api::management_canister;
use ic_cdk::api::management_canister::main::{CanisterInstallMode, ChunkHash, InstallChunkedCodeArgument, InstallCodeArgument};
use tracing::{error, trace};
use types::{BuildVersion, CanisterId, CanisterWasm, CanisterWasmBytes, Cycles, Hash};

pub struct CanisterToInstall<A: CandidType> {
    pub canister_id: CanisterId,
    pub current_wasm_version: BuildVersion,
    pub new_wasm_version: BuildVersion,
    pub new_wasm: WasmToInstall,
    pub deposit_cycles_if_needed: bool,
    pub args: A,
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

pub async fn install_basic<A: CandidType>(canister_id: CanisterId, wasm: CanisterWasm, init_args: A) -> CallResult<()> {
    install(CanisterToInstall {
        canister_id,
        current_wasm_version: BuildVersion::default(),
        new_wasm_version: wasm.version,
        new_wasm: WasmToInstall::Default(wasm.module),
        deposit_cycles_if_needed: true,
        args: init_args,
        mode: CanisterInstallMode::Install,
        stop_start_canister: false,
    })
    .await
    .map(|_| ())
}

pub async fn install<A: CandidType>(canister_to_install: CanisterToInstall<A>) -> CallResult<Option<Cycles>> {
    let canister_id = canister_to_install.canister_id;
    let mode = canister_to_install.mode;

    trace!(%canister_id, ?mode, "Canister install starting");

    if canister_to_install.stop_start_canister {
        canister::stop(canister_id).await?;
    }

    let install_code_args = match canister_to_install.new_wasm {
        WasmToInstall::Default(wasm_module) => InstallCodeArgs::Default(InstallCodeArgument {
            mode,
            canister_id,
            wasm_module: wasm_module.into(),
            arg: candid::encode_one(canister_to_install.args).unwrap(),
        }),
        WasmToInstall::Chunked(wasm) => InstallCodeArgs::Chunked(InstallChunkedCodeArgument {
            mode,
            target_canister: canister_id,
            store_canister: Some(wasm.store_canister_id),
            chunk_hashes_list: wasm
                .chunks
                .into_iter()
                .map(|hash| ChunkHash { hash: hash.to_vec() })
                .collect(),
            wasm_module_hash: wasm.wasm_hash.to_vec(),
            arg: candid::encode_one(canister_to_install.args).unwrap(),
        }),
    };

    let mut install_code_response = install_code_args.clone().install().await;
    let mut cycles_used = None;
    let mut error = None;
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

    if let Err((code, msg)) = install_code_response {
        error!(
            %canister_id,
            ?mode,
            from_wasm_version = %canister_to_install.current_wasm_version,
            to_wasm_version = %canister_to_install.new_wasm_version,
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
        if matches!(code, RejectionCode::SysTransient) && msg.contains("out of cycles") {
            return ShouldDepositAndRetry::Yes(CYCLES_REQUIRED_FOR_UPGRADE / 2);
        }
    }
    ShouldDepositAndRetry::No
}

#[derive(Clone)]
enum InstallCodeArgs {
    Default(InstallCodeArgument),
    Chunked(InstallChunkedCodeArgument),
}

impl InstallCodeArgs {
    async fn install(self) -> CallResult<()> {
        match self {
            InstallCodeArgs::Default(args) => management_canister::main::install_code(args.clone()).await,
            InstallCodeArgs::Chunked(args) => management_canister::main::install_chunked_code(args.clone()).await,
        }
    }
}
