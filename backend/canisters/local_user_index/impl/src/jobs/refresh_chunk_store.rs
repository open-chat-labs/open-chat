use crate::{RuntimeState, mutate_state, read_state};
use constants::SECOND_IN_MS;
use local_user_index_canister::ChildCanisterType;
use serde::Serialize;
use std::cell::Cell;
use std::collections::HashSet;
use std::time::Duration;
use tracing::{error, info};
use types::{CanisterId, Hash, Milliseconds};
use utils::canister::{
    chunked_installs_in_progress, clear_chunk_store, stored_chunks, upload_wasm_in_chunks, wasm_chunk_hashes,
};

const CHILD_CANISTER_TYPES: [ChildCanisterType; 4] = [
    ChildCanisterType::User,
    ChildCanisterType::Group,
    ChildCanisterType::Community,
    ChildCanisterType::MultiUser,
];

const RETRY_DELAY: Milliseconds = 5 * SECOND_IN_MS;

thread_local! {
    static IN_PROGRESS: Cell<bool> = Cell::default();
    static CLEAR_COUNT: Cell<u64> = Cell::default();
}

// Keeps the chunks of the current child canister wasms in this canister's chunk store, so that
// canisters can be installed from them at any time, recording each wasm's chunk hashes only while
// its chunks are in the store. Canisters are installed from the full wasm otherwise.
//
// Once the last upgrade in a series completes, the chunks of the old wasms are removed. The
// management canister can only clear a chunk store in full, so this is done by clearing the store
// then uploading the current wasms' chunks again, and only once no upgrades are pending and no
// installs from the store are in progress.
pub(crate) fn remove_stale_chunks_if_no_pending_upgrades() {
    if read_state(no_pending_upgrades) {
        start(true);
    }
}

// Run on start up, after `clear_chunk_hashes` in `post_upgrade`, to record the hashes of the
// current wasms' chunks again, uploading any which are missing from the store
pub(crate) fn start_job() {
    ic_cdk_timers::set_timer(Duration::ZERO, async { start(false) });
}

// Called in `post_upgrade`, since earlier versions of this canister cleared the chunk store without
// clearing the chunk hashes, so they can't be relied on until the chunks are checked
pub(crate) fn clear_chunk_hashes(state: &mut RuntimeState) {
    for canister_type in CHILD_CANISTER_TYPES {
        if !state.data.child_canister_wasms.get(canister_type).chunks.is_empty() {
            state.data.child_canister_wasms.set_chunk_hashes(canister_type, Vec::new());
        }
    }
}

// The number of times the chunk store has been cleared since this canister was last upgraded.
// A new wasm's chunks uploaded while this changed may have been removed, so their hashes mustn't
// be recorded
pub(crate) fn clear_count() -> u64 {
    CLEAR_COUNT.get()
}

#[derive(Serialize, Debug)]
pub struct ChunkStoreMetrics {
    pub sync_in_progress: bool,
    pub clears: u64,
    pub chunked_installs_in_progress: usize,
}

pub(crate) fn metrics() -> ChunkStoreMetrics {
    ChunkStoreMetrics {
        sync_in_progress: IN_PROGRESS.get(),
        clears: CLEAR_COUNT.get(),
        chunked_installs_in_progress: chunked_installs_in_progress(),
    }
}

fn start(remove_stale: bool) {
    if !IN_PROGRESS.get() {
        IN_PROGRESS.set(true);
        utils::async_work::spawn_tracked(async move {
            sync(remove_stale).await;
            IN_PROGRESS.set(false);
        });
    }
}

fn no_pending_upgrades(state: &RuntimeState) -> bool {
    state.data.users_requiring_upgrade.is_empty()
        && state.data.groups_requiring_upgrade.is_empty()
        && state.data.communities_requiring_upgrade.is_empty()
        && state.data.multi_users_requiring_upgrade.is_empty()
}

struct CurrentWasm {
    canister_type: ChildCanisterType,
    wasm_hash: Hash,
    chunks: Vec<Hash>,
}

async fn sync(remove_stale: bool) {
    let canister_id = read_state(|state| state.env.canister_id());
    let mut stored: HashSet<Hash> = match stored_chunks(canister_id).await {
        Ok(chunks) => chunks.into_iter().collect(),
        Err(error) => {
            error!(?error, "Failed to get stored chunks");
            return;
        }
    };

    let current = read_state(current_wasms);
    let expected: HashSet<Hash> = current.iter().flat_map(|w| w.chunks.iter().copied()).collect();

    if remove_stale && stored.iter().any(|h| !expected.contains(h)) {
        // No new installs from the store start once the chunk hashes are cleared
        mutate_state(clear_chunk_hashes);

        // Upgrades may have been queued while awaiting the stored chunks, in which case the stale
        // chunks are removed once they complete
        if !read_state(no_pending_upgrades) {
            return;
        }
        if chunked_installs_in_progress() > 0 {
            ic_cdk_timers::set_timer(Duration::from_millis(RETRY_DELAY), async {
                remove_stale_chunks_if_no_pending_upgrades()
            });
            return;
        }

        CLEAR_COUNT.set(CLEAR_COUNT.get() + 1);
        if let Err(error) = clear_chunk_store(canister_id).await {
            error!(?error, "Failed to clear chunk store");
            return;
        }
        stored.clear();
        info!("Chunk store cleared");
    }

    futures::future::join_all(current.into_iter().map(|wasm| record_chunks(canister_id, wasm, &stored))).await;
}

fn current_wasms(state: &RuntimeState) -> Vec<CurrentWasm> {
    CHILD_CANISTER_TYPES
        .into_iter()
        .filter_map(|canister_type| {
            let wasm = state.data.child_canister_wasms.get(canister_type);
            (!wasm.wasm.module.is_empty()).then(|| CurrentWasm {
                canister_type,
                wasm_hash: wasm.wasm_hash,
                chunks: wasm_chunk_hashes(&wasm.wasm.module),
            })
        })
        .collect()
}

// Uploads the wasm's chunks unless they're all in the store already, then records their hashes,
// unless the wasm has since been replaced, since the new wasm's chunk hashes were recorded when it
// was set
async fn record_chunks(canister_id: CanisterId, wasm: CurrentWasm, stored: &HashSet<Hash>) {
    let canister_type = wasm.canister_type;

    if !wasm.chunks.iter().all(|h| stored.contains(h)) {
        let Some(module) = read_state(|state| {
            let current = state.data.child_canister_wasms.get(canister_type);
            (current.wasm_hash == wasm.wasm_hash).then(|| current.wasm.module.clone())
        }) else {
            return;
        };

        match upload_wasm_in_chunks(&module, canister_id).await {
            Ok(chunks) if chunks == wasm.chunks => info!(?canister_type, "Wasm chunks uploaded"),
            Ok(_) => {
                error!(?canister_type, "Uploaded wasm chunks don't match those expected");
                return;
            }
            Err(error) => {
                // Canisters are installed from the full wasm until the chunks are next checked
                error!(?canister_type, ?error, "Failed to upload wasm chunks");
                return;
            }
        }
    }

    mutate_state(|state| {
        let wasms = &mut state.data.child_canister_wasms;
        if wasms.get(canister_type).wasm_hash == wasm.wasm_hash {
            wasms.set_chunk_hashes(canister_type, wasm.chunks);
        }
    });
}
