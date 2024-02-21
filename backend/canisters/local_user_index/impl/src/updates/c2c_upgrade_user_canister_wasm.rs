use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, read_state, Data, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use ic_cdk::api::management_canister::main::{ClearChunkStoreArgument, UploadChunkArgument};
use itertools::Itertools;
use local_user_index_canister::c2c_upgrade_user_canister_wasm::{Response::*, *};
use sha256::sha256;
use std::cmp::Reverse;
use std::collections::HashSet;
use tracing::info;
use types::{BuildVersion, CanisterId, ChunkedCanisterWasm, Hash};
use utils::canister::should_perform_upgrade;

const ONE_MB: usize = 1024 * 1024;

#[update_msgpack(guard = "caller_is_user_index_canister")]
#[trace]
async fn c2c_upgrade_user_canister_wasm(args: Args) -> Response {
    let PrepareResult { this_canister_id } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if args.use_for_new_canisters.unwrap_or(true) {
        ic_cdk::api::management_canister::main::clear_chunk_store(ClearChunkStoreArgument {
            canister_id: this_canister_id,
        })
        .await
        .unwrap();
    }

    let mut chunks = Vec::new();
    for chunk in args.wasm.module.chunks(ONE_MB) {
        let (chunk_hash,) = ic_cdk::api::management_canister::main::upload_chunk(UploadChunkArgument {
            canister_id: this_canister_id,
            chunk: chunk.to_vec(),
        })
        .await
        .unwrap();

        chunks.push(chunk_hash.hash.try_into().unwrap());
    }

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
    state.data.canisters_requiring_upgrade.clear();
    let version = args.wasm.version;
    let wasm_hash = sha256(&args.wasm.module);

    let chunked_wasm = ChunkedCanisterWasm {
        wasm: args.wasm,
        chunks,
        wasm_hash,
    };
    if args.use_for_new_canisters.unwrap_or(true) {
        state.data.user_canister_wasm_for_new_canisters = chunked_wasm.clone();
    }
    state.data.user_canister_wasm_for_upgrades = chunked_wasm;

    let filter = args.filter.unwrap_or_default();
    let include: HashSet<_> = filter.include.into_iter().collect();
    let include_all = include.is_empty();
    let exclude: HashSet<_> = filter.exclude.into_iter().collect();

    for canister_id in state
        .data
        .local_users
        .iter()
        .filter(|(user_id, user)| {
            should_perform_upgrade(user.wasm_version, version, state.data.test_mode) && !state.data.global_users.is_bot(user_id)
        })
        .map(|(user_id, _)| CanisterId::from(*user_id))
        .filter(|c| include_all || include.contains(c))
        .filter(|c| !exclude.contains(c))
        .sorted_by_key(|&c| Reverse(state.data.global_users.diamond_membership_expiry_date(&c.into())))
    {
        state.data.canisters_requiring_upgrade.enqueue(canister_id, false);
    }
    crate::jobs::upgrade_canisters::start_job_if_required(state);

    let canisters_queued_for_upgrade = state.data.canisters_requiring_upgrade.count_pending();
    info!(%version, canisters_queued_for_upgrade, "User canister wasm upgraded");
    Success
}

fn min_canister_version(data: &Data) -> Option<BuildVersion> {
    data.local_users.iter().map(|(_, u)| u.wasm_version).min()
}
