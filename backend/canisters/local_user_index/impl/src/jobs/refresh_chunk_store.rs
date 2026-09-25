use crate::{RuntimeState, mutate_state, read_state};
use local_user_index_canister::ChildCanisterType;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};
use types::CanisterId;
use utils::canister::{clear_chunk_store, upload_wasm_in_chunks};

const CHILD_CANISTER_TYPES: [ChildCanisterType; 4] = [
    ChildCanisterType::User,
    ChildCanisterType::Group,
    ChildCanisterType::Community,
    ChildCanisterType::MultiUser,
];

thread_local! {
    static IN_PROGRESS: Cell<bool> = Cell::default();
    static CLEAR_COUNT: Cell<u64> = Cell::default();
}

// The management canister can only clear a chunk store in full, so to remove the chunks of old
// wasms once the upgrades to the new ones are complete, the store is cleared then the chunks of
// each current child canister wasm are uploaded again, so that canisters can still be installed
// from them. Until a wasm's chunks are back in the store its chunk hashes are cleared, so that
// canisters are installed from the full wasm instead.
pub(crate) fn refresh_if_no_pending_upgrades() {
    if read_state(no_pending_upgrades) {
        start_refresh(true);
    }
}

// Run on start up, after `clear_chunk_hashes` in `post_upgrade`, to upload the current wasms'
// chunks and record their hashes again, clearing the store first if no upgrades are pending
pub(crate) fn start_job() {
    ic_cdk_timers::set_timer(Duration::ZERO, async { start_refresh(read_state(no_pending_upgrades)) });
}

// Called in `post_upgrade`, since earlier versions of this canister cleared the chunk store
// without clearing the chunk hashes, so they can't be relied on until the chunks are uploaded again
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

fn start_refresh(clear_store: bool) {
    if !IN_PROGRESS.get() {
        IN_PROGRESS.set(true);
        utils::async_work::spawn_tracked(async move {
            refresh(clear_store).await;
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

async fn refresh(clear_store: bool) {
    let canister_id = read_state(|state| state.env.canister_id());

    if clear_store {
        mutate_state(clear_chunk_hashes);
        CLEAR_COUNT.set(CLEAR_COUNT.get() + 1);
        match clear_chunk_store(canister_id).await {
            Ok(()) => info!("Chunk store cleared"),
            // The chunks are uploaded again regardless, since uploading a chunk already in the
            // store is a no-op
            Err(error) => error!(?error, "Failed to clear chunk store"),
        }
    }

    futures::future::join_all(CHILD_CANISTER_TYPES.map(|canister_type| upload_chunks(canister_id, canister_type))).await;
}

// Uploads the chunks of the current wasm, then records their hashes, unless the wasm was replaced
// while uploading, in which case the new wasm's chunks are uploaded, since they may have been
// uploaded before the store was cleared
async fn upload_chunks(canister_id: CanisterId, canister_type: ChildCanisterType) {
    loop {
        let Some((module, wasm_hash)) = read_state(|state| {
            let wasm = state.data.child_canister_wasms.get(canister_type);
            (!wasm.wasm.module.is_empty()).then(|| (wasm.wasm.module.clone(), wasm.wasm_hash))
        }) else {
            return;
        };

        let chunks = match upload_wasm_in_chunks(&module, canister_id).await {
            Ok(chunks) => chunks,
            Err(error) => {
                // Canisters are installed from the full wasm until the store is next refreshed
                error!(?canister_type, ?error, "Failed to upload wasm chunks");
                return;
            }
        };

        let recorded = mutate_state(|state| {
            let wasms = &mut state.data.child_canister_wasms;
            if wasms.get(canister_type).wasm_hash == wasm_hash {
                wasms.set_chunk_hashes(canister_type, chunks);
                true
            } else {
                false
            }
        });
        if recorded {
            info!(?canister_type, "Wasm chunks uploaded");
            return;
        }
    }
}
