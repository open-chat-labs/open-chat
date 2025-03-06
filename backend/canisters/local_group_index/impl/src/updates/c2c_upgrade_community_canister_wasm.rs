use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, read_state, Data, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_upgrade_community_canister_wasm::*;
use local_group_index_canister::ChildCanisterType;
use sha256::sha256;
use tracing::info;
use types::{BuildVersion, CanisterId, CanisterWasm, ChunkedCanisterWasm, Hash, UpgradeChunkedCanisterWasmResponse::*};
use utils::canister::{should_perform_upgrade, upload_wasm_in_chunks};

#[update(guard = "caller_is_group_index_canister", msgpack = true)]
#[trace]
async fn c2c_upgrade_community_canister_wasm(args: Args) -> Response {
    let PrepareResult {
        this_canister_id,
        clear_chunk_store,
        wasm,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if clear_chunk_store {
        utils::canister::clear_chunk_store(this_canister_id).await.unwrap();
    }

    let chunks = upload_wasm_in_chunks(&wasm.module, this_canister_id).await.unwrap();

    mutate_state(|state| commit(args, wasm, chunks, state))
}

struct PrepareResult {
    this_canister_id: CanisterId,
    clear_chunk_store: bool,
    wasm: CanisterWasm,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    let wasm = state.data.child_canister_wasms.wasm_from_chunks(ChildCanisterType::Community);
    let wasm_hash = sha256(&wasm);

    if wasm_hash != args.wasm_hash {
        Err(HashMismatch(wasm_hash))
    } else if !state.data.test_mode && Some(args.version) <= min_canister_version(&state.data) {
        Err(VersionNotHigher)
    } else {
        Ok(PrepareResult {
            this_canister_id: state.env.canister_id(),
            clear_chunk_store: state.data.groups_requiring_upgrade.is_empty(),
            wasm: CanisterWasm {
                version: args.version,
                module: wasm,
            },
        })
    }
}

fn commit(args: Args, wasm: CanisterWasm, chunks: Vec<Hash>, state: &mut RuntimeState) -> Response {
    state.data.communities_requiring_upgrade.clear();
    let version = args.version;
    let wasm_hash = args.wasm_hash;

    state
        .data
        .child_canister_wasms
        .set(ChildCanisterType::Community, ChunkedCanisterWasm { wasm, chunks, wasm_hash });

    let filter = args.filter.unwrap_or_default();

    for canister_id in state
        .data
        .local_communities
        .iter()
        .filter(|(community_id, community)| {
            should_perform_upgrade(
                (**community_id).into(),
                community.wasm_version,
                version,
                &filter,
                state.data.test_mode,
            )
        })
        .map(|(community_id, _)| CanisterId::from(*community_id))
    {
        state.data.communities_requiring_upgrade.enqueue(canister_id, false);
    }
    crate::jobs::upgrade_communities::start_job_if_required(state);

    state.data.communities_requiring_upgrade.clear_failed(BuildVersion {
        major: version.major,
        minor: version.minor,
        patch: version.patch.saturating_sub(100),
    });

    let canisters_queued_for_upgrade = state.data.communities_requiring_upgrade.count_pending();
    info!(%version, canisters_queued_for_upgrade, "Community canister wasm upgraded");
    Success
}

fn min_canister_version(data: &Data) -> Option<BuildVersion> {
    data.local_communities.iter().map(|(_, c)| c.wasm_version).min()
}
