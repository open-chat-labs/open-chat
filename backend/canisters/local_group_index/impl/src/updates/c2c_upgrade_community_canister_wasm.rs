use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, read_state, Data, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_upgrade_community_canister_wasm::{Response::*, *};
use sha256::sha256;
use std::collections::HashSet;
use tracing::info;
use types::{BuildVersion, CanisterId, ChunkedCanisterWasm, Hash};
use utils::canister::{clear_chunk_store, should_perform_upgrade, upload_wasm_in_chunks};

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
async fn c2c_upgrade_community_canister_wasm(args: Args) -> Response {
    let PrepareResult { this_canister_id } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if args.use_for_new_canisters.unwrap_or(true) {
        clear_chunk_store(this_canister_id).await;
    }

    let chunks = upload_wasm_in_chunks(&args.wasm.module, this_canister_id).await;

    mutate_state(|state| commit(args, chunks, state))
}

struct PrepareResult {
    this_canister_id: CanisterId,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !state.data.test_mode && Some(args.wasm.version) <= min_canister_version(&state.data) {
        Err(VersionNotHigher)
    } else {
        Ok(PrepareResult {
            this_canister_id: state.env.canister_id(),
        })
    }
}

fn commit(args: Args, chunks: Vec<Hash>, state: &mut RuntimeState) -> Response {
    state.data.communities_requiring_upgrade.clear();
    let version = args.wasm.version;
    let wasm_hash = sha256(&args.wasm.module);

    let chunked_wasm = ChunkedCanisterWasm {
        wasm: args.wasm,
        chunks,
        wasm_hash,
    };
    if args.use_for_new_canisters.unwrap_or(true) {
        state.data.community_canister_wasm_for_new_canisters = chunked_wasm.clone();
    }
    state.data.community_canister_wasm_for_upgrades = chunked_wasm;

    let filter = args.filter.unwrap_or_default();
    let include: HashSet<_> = filter.include.into_iter().collect();
    let include_all = include.is_empty();
    let exclude: HashSet<_> = filter.exclude.into_iter().collect();

    for canister_id in state
        .data
        .local_communities
        .iter()
        .filter(|(_, community)| should_perform_upgrade(community.wasm_version, version, state.data.test_mode))
        .map(|(community_id, _)| CanisterId::from(*community_id))
        .filter(|c| include_all || include.contains(c))
        .filter(|c| !exclude.contains(c))
    {
        state.data.communities_requiring_upgrade.enqueue(canister_id, false);
    }

    let canisters_queued_for_upgrade = state.data.communities_requiring_upgrade.count_pending();
    info!(%version, canisters_queued_for_upgrade, "Community canister wasm upgraded");
    Success
}

fn min_canister_version(data: &Data) -> Option<BuildVersion> {
    data.local_communities.iter().map(|(_, c)| c.wasm_version).min()
}
