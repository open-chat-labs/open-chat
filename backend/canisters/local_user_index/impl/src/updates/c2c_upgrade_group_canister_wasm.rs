use crate::guards::caller_is_group_index;
use crate::jobs::refresh_chunk_store;
use crate::{Data, RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::ChildCanisterType;
use local_user_index_canister::c2c_upgrade_group_canister_wasm::*;
use sha256::sha256;
use tracing::info;
use types::{BuildVersion, CanisterId, CanisterWasm, ChunkedCanisterWasm, Hash, UpgradeChunkedCanisterWasmResponse::*};
use utils::canister::{should_perform_upgrade, upload_wasm_in_chunks};

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
async fn c2c_upgrade_group_canister_wasm(args: Args) -> Response {
    let PrepareResult { this_canister_id, wasm } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let clear_count = refresh_chunk_store::clear_count();
    let chunks = upload_wasm_in_chunks(&wasm.module, this_canister_id).await.unwrap();
    // If the chunk store was cleared while uploading, the chunks may have been removed, so the
    // wasm is installed in full until its chunks are uploaded again when the store is refreshed
    let chunks = if refresh_chunk_store::clear_count() == clear_count { chunks } else { Vec::new() };

    let response = mutate_state(|state| commit(args, wasm, chunks, state));
    // If there are no canisters to upgrade, the old wasm's chunks can be removed straight away
    refresh_chunk_store::remove_stale_chunks_if_no_pending_upgrades();
    response
}

struct PrepareResult {
    this_canister_id: CanisterId,
    wasm: CanisterWasm,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    let wasm = state.data.child_canister_wasms.wasm_from_chunks(ChildCanisterType::Group);
    let wasm_hash = sha256(&wasm);

    if wasm_hash != args.wasm_hash {
        Err(HashMismatch(wasm_hash))
    } else if !state.data.test_mode && Some(args.version) <= min_canister_version(&state.data) {
        Err(VersionNotHigher)
    } else {
        Ok(PrepareResult {
            this_canister_id: state.env.canister_id(),
            wasm: CanisterWasm {
                version: args.version,
                module: wasm,
            },
        })
    }
}

fn commit(args: Args, wasm: CanisterWasm, chunks: Vec<Hash>, state: &mut RuntimeState) -> Response {
    state.data.groups_requiring_upgrade.clear();
    let version = args.version;
    let wasm_hash = args.wasm_hash;

    state
        .data
        .child_canister_wasms
        .set(ChildCanisterType::Group, ChunkedCanisterWasm { wasm, chunks, wasm_hash });

    let filter = args.filter.unwrap_or_default();

    for canister_id in state
        .data
        .local_groups
        .iter()
        .filter(|(group_id, group)| {
            should_perform_upgrade(
                (**group_id).into(),
                group.wasm_version,
                version,
                &filter,
                state.data.test_mode,
            )
        })
        .map(|(chat_id, _)| CanisterId::from(*chat_id))
    {
        state.data.groups_requiring_upgrade.enqueue(canister_id, false);
    }
    crate::jobs::upgrade_groups::start_job_if_required(state);

    state.data.groups_requiring_upgrade.clear_failed(BuildVersion {
        major: version.major,
        minor: version.minor,
        patch: version.patch.saturating_sub(100),
    });

    let canisters_queued_for_upgrade = state.data.groups_requiring_upgrade.count_pending();
    info!(%version, canisters_queued_for_upgrade, "Group canister wasm upgraded");
    Success
}

fn min_canister_version(data: &Data) -> Option<BuildVersion> {
    data.local_groups.iter().map(|(_, g)| g.wasm_version).min()
}
