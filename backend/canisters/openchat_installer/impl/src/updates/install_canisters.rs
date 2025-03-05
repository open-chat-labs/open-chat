use crate::guards::caller_is_governance_principal;
use crate::{read_state, State};
use candid::CandidType;
use canister_tracing_macros::trace;
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::CanisterInstallMode;
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
    let wasm_version = args.wasm_version;

    let PrepareResult {
        user_index,
        group_index,
        notifications_index,
    } = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let results = futures::future::try_join3(
        install_canister(user_index, wasm_version),
        install_canister(group_index, wasm_version),
        install_canister(notifications_index, wasm_version),
    )
    .await;

    match results {
        Ok(_) => Success,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    user_index: InstallCanisterArgs<user_index_canister::init::Args>,
    group_index: InstallCanisterArgs<group_index_canister::init::Args>,
    notifications_index: InstallCanisterArgs<notifications_index_canister::init::Args>,
}

struct InstallCanisterArgs<A: CandidType> {
    canister_id: CanisterId,
    wasm: CanisterWasmBytes,
    wasm_hash: Hash,
    init_args: A,
}

fn prepare(args: Args, state: &State) -> Result<PrepareResult, Response> {
    let user_index_wasm_hash = state.data.canister_wasms.chunks_hash(CanisterType::UserIndex);
    let group_index_wasm_hash = state.data.canister_wasms.chunks_hash(CanisterType::GroupIndex);
    let notifications_index_wasm_hash = state.data.canister_wasms.chunks_hash(CanisterType::NotificationsIndex);

    if user_index_wasm_hash != args.user_index_wasm_hash {
        Err(HashMismatch(CanisterType::UserIndex, user_index_wasm_hash))
    } else if group_index_wasm_hash != args.group_index_wasm_hash {
        Err(HashMismatch(CanisterType::GroupIndex, group_index_wasm_hash))
    } else if notifications_index_wasm_hash != args.notifications_index_wasm_hash {
        Err(HashMismatch(CanisterType::NotificationsIndex, group_index_wasm_hash))
    } else {
        let user_index = InstallCanisterArgs {
            canister_id: state.data.user_index_canister_id,
            wasm: state.data.canister_wasms.wasm_from_chunks(CanisterType::UserIndex),
            wasm_hash: args.user_index_wasm_hash,
            init_args: user_index_canister::init::Args {
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
        };

        let group_index = InstallCanisterArgs {
            canister_id: state.data.group_index_canister_id,
            wasm: state.data.canister_wasms.wasm_from_chunks(CanisterType::GroupIndex),
            wasm_hash: args.group_index_wasm_hash,
            init_args: group_index_canister::init::Args {
                governance_principals: state.data.governance_principals.clone(),
                user_index_canister_id: state.data.user_index_canister_id,
                cycles_dispenser_canister_id: state.data.cycles_dispenser_canister_id,
                proposals_bot_user_id: state.data.proposals_bot_canister_id.into(),
                escrow_canister_id: state.data.escrow_canister_id,
                event_relay_canister_id: state.data.event_relay_canister_id,
                registry_canister_id: state.data.registry_canister_id,
                internet_identity_canister_id: state.data.internet_identity_canister_id,
                video_call_operators: args.video_call_operators.clone(),
                ic_root_key: state.data.ic_root_key.clone(),
                wasm_version: args.wasm_version,
                test_mode: state.data.test_mode,
            },
        };

        let notifications_index = InstallCanisterArgs {
            canister_id: state.data.notifications_index_canister_id,
            wasm: state.data.canister_wasms.wasm_from_chunks(CanisterType::NotificationsIndex),
            wasm_hash: args.notifications_index_wasm_hash,
            init_args: notifications_index_canister::init::Args {
                governance_principals: state.data.governance_principals.clone(),
                push_service_principals: args.push_service_principals,
                user_index_canister_id: state.data.user_index_canister_id,
                authorizers: vec![state.data.user_index_canister_id, state.data.group_index_canister_id],
                cycles_dispenser_canister_id: state.data.cycles_dispenser_canister_id,
                registry_canister_id: state.data.registry_canister_id,
                wasm_version: args.wasm_version,
                test_mode: state.data.test_mode,
            },
        };

        Ok(PrepareResult {
            user_index,
            group_index,
            notifications_index,
        })
    }
}

async fn install_canister<A: CandidType>(
    args: InstallCanisterArgs<A>,
    wasm_version: BuildVersion,
) -> Result<(), (RejectCode, String)> {
    let chunks = upload_wasm_in_chunks(&args.wasm, args.canister_id).await?;

    install(CanisterToInstall {
        canister_id: args.canister_id,
        current_wasm_version: BuildVersion::default(),
        new_wasm_version: wasm_version,
        new_wasm: WasmToInstall::Chunked(ChunkedWasmToInstall {
            chunks,
            wasm_hash: args.wasm_hash,
            store_canister_id: args.canister_id,
        }),
        deposit_cycles_if_needed: false,
        args: args.init_args,
        mode: CanisterInstallMode::Install,
        stop_start_canister: false,
    })
    .await?;

    let _ = clear_chunk_store(args.canister_id).await;

    Ok(())
}

#[derive(CandidType)]
struct UpgradeArgs {
    wasm_version: BuildVersion,
}
