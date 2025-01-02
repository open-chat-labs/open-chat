use crate::guards::caller_is_governance_principal;
use crate::{read_state, State};
use candid::CandidType;
use canister_tracing_macros::trace;
use ic_cdk::api::management_canister::main::CanisterInstallMode;
use ic_cdk::update;
use openchat_installer_canister::install_canisters::{Response::*, *};
use openchat_installer_canister::CanisterType;
use types::{BuildVersion, CanisterId, CanisterWasmBytes, Hash};
use utils::canister::{
    clear_chunk_store, install, upload_wasm_in_chunks, CanisterToInstall, ChunkedWasmToInstall, WasmToInstall,
};

#[update(guard = "caller_is_governance_principal")]
#[trace]
async fn install_canisters(args: Args) -> Response {
    let PrepareResult {
        user_index_canister_id,
        user_index_wasm,
        user_index_wasm_hash,
        user_index_init_args,
    } = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let chunks = match upload_wasm_in_chunks(&user_index_wasm, user_index_canister_id).await {
        Ok(chunks) => chunks,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    if let Err(error) = install(CanisterToInstall {
        canister_id: user_index_canister_id,
        current_wasm_version: BuildVersion::default(),
        new_wasm_version: user_index_init_args.wasm_version,
        new_wasm: WasmToInstall::Chunked(ChunkedWasmToInstall {
            chunks,
            wasm_hash: user_index_wasm_hash,
            store_canister_id: user_index_canister_id,
        }),
        deposit_cycles_if_needed: false,
        args: user_index_init_args,
        mode: CanisterInstallMode::Install,
        stop_start_canister: false,
    })
    .await
    {
        return InternalError(format!("{error:?}"));
    };

    let _ = clear_chunk_store(user_index_canister_id).await;

    Success
}

struct PrepareResult {
    user_index_canister_id: CanisterId,
    user_index_wasm: CanisterWasmBytes,
    user_index_wasm_hash: Hash,
    user_index_init_args: user_index_canister::init::Args,
}

fn prepare(args: Args, state: &State) -> Result<PrepareResult, Response> {
    let user_index_canister_wasm = state.data.canister_wasms.get(CanisterType::UserIndex);

    if user_index_canister_wasm.wasm_hash != args.user_index_wasm_hash {
        Err(HashMismatch(CanisterType::UserIndex, user_index_canister_wasm.wasm_hash))
    } else {
        Ok(PrepareResult {
            user_index_canister_id: state.data.user_index_canister_id,
            user_index_wasm: user_index_canister_wasm.wasm.module.clone(),
            user_index_wasm_hash: args.user_index_wasm_hash,
            user_index_init_args: user_index_canister::init::Args {
                governance_principals: state.data.governance_principals.clone(),
                group_index_canister_id: state.data.group_index_canister_id,
                notifications_index_canister_id: state.data.notifications_index_canister_id,
                identity_canister_id: state.data.identity_canister_id,
                proposals_bot_canister_id: state.data.proposals_bot_canister_id,
                airdrop_bot_canister_id: state.data.airdrop_bot_canister_id,
                online_users_canister_id: state.data.online_users_canister_id,
                cycles_dispenser_canister_id: state.data.cycles_dispenser_canister_id,
                storage_index_canister_id: state.data.storage_index_canister_id,
                escrow_canister_id: state.data.escrow_canister_id,
                event_relay_canister_id: state.data.event_relay_canister_id,
                registry_canister_id: state.data.registry_canister_id,
                nns_governance_canister_id: state.data.nns_governance_canister_id,
                internet_identity_canister_id: state.data.internet_identity_canister_id,
                translations_canister_id: state.data.translations_canister_id,
                website_canister_id: state.data.website_canister_id,
                video_call_operators: args.video_call_operators.clone(),
                ic_root_key: state.data.ic_root_key.clone(),
                wasm_version: args.wasm_version,
                test_mode: state.data.test_mode,
            },
        })
    }
}

#[derive(CandidType)]
struct UpgradeArgs {
    wasm_version: BuildVersion,
}
