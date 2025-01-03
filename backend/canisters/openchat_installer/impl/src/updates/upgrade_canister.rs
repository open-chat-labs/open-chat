use crate::guards::caller_is_governance_principal;
use crate::{read_state, State};
use candid::CandidType;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use ic_cdk::api::management_canister::main::CanisterInstallMode;
use openchat_installer_canister::upgrade_canister::*;
use openchat_installer_canister::CanisterType;
use types::{BuildVersion, CanisterId, CanisterWasmBytes, UpgradeChunkedCanisterWasmArgs, UpgradeChunkedCanisterWasmResponse};
use utils::canister::{
    clear_chunk_store, install, upload_wasm_in_chunks, CanisterToInstall, ChunkedWasmToInstall, WasmToInstall,
};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn upgrade_canister(args: Args) -> Response {
    let PrepareResult { canister_id, wasm, args } = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let chunks = match upload_wasm_in_chunks(&wasm, canister_id).await {
        Ok(chunks) => chunks,
        Err(error) => return UpgradeChunkedCanisterWasmResponse::InternalError(format!("{error:?}")),
    };

    let response = match install(CanisterToInstall {
        canister_id,
        current_wasm_version: BuildVersion::default(),
        new_wasm_version: args.version,
        new_wasm: WasmToInstall::Chunked(ChunkedWasmToInstall {
            chunks,
            wasm_hash: args.wasm_hash,
            store_canister_id: canister_id,
        }),
        deposit_cycles_if_needed: false,
        args: UpgradeArgs {
            wasm_version: args.version,
        },
        mode: CanisterInstallMode::Upgrade(None),
        stop_start_canister: true,
    })
    .await
    {
        Ok(_) => UpgradeChunkedCanisterWasmResponse::Success,
        Err(error) => UpgradeChunkedCanisterWasmResponse::InternalError(format!("{error:?}")),
    };

    let _ = clear_chunk_store(canister_id).await;

    response
}

struct PrepareResult {
    canister_id: CanisterId,
    wasm: CanisterWasmBytes,
    args: UpgradeChunkedCanisterWasmArgs,
}

fn prepare(args: Args, state: &State) -> Result<PrepareResult, Response> {
    let canister_wasm = state.data.canister_wasms.get(args.canister_type);

    if canister_wasm.wasm_hash != args.wasm_hash {
        Err(UpgradeChunkedCanisterWasmResponse::HashMismatch(canister_wasm.wasm_hash))
    } else {
        let canister_id = match args.canister_type {
            CanisterType::UserIndex => state.data.user_index_canister_id,
        };

        Ok(PrepareResult {
            canister_id,
            wasm: canister_wasm.wasm.module.clone(),
            args: UpgradeChunkedCanisterWasmArgs {
                version: args.version,
                wasm_hash: args.wasm_hash,
                filter: args.filter,
            },
        })
    }
}

#[derive(CandidType)]
struct UpgradeArgs {
    wasm_version: BuildVersion,
}
