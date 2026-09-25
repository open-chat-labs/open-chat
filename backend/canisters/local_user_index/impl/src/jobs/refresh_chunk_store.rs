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
}

// The management canister can only clear a chunk store in full, so to remove the chunks of old
// wasms once the upgrades to the new ones are complete, the store is cleared then the chunks of
// each current child canister wasm are uploaded again, so that canisters can still be installed
// from them. Until a wasm's chunks are back in the store its chunk hashes are cleared, so that
// canisters are installed from the full wasm instead.
pub(crate) fn refresh_if_no_pending_upgrades() {
    if !IN_PROGRESS.get() && read_state(no_pending_upgrades) {
        IN_PROGRESS.set(true);
        utils::async_work::spawn_tracked(async {
            refresh().await;
            IN_PROGRESS.set(false);
        });
    }
}

// Run on start up, since earlier versions of this canister cleared the chunk store without
// uploading the current wasms' chunks again
pub(crate) fn start_job() {
    ic_cdk_timers::set_timer(Duration::ZERO, async { refresh_if_no_pending_upgrades() });
}

fn no_pending_upgrades(state: &RuntimeState) -> bool {
    state.data.users_requiring_upgrade.is_empty()
        && state.data.groups_requiring_upgrade.is_empty()
        && state.data.communities_requiring_upgrade.is_empty()
        && state.data.multi_users_requiring_upgrade.is_empty()
}

async fn refresh() {
    let canister_id = mutate_state(|state| {
        for canister_type in CHILD_CANISTER_TYPES {
            if !state.data.child_canister_wasms.get(canister_type).chunks.is_empty() {
                state.data.child_canister_wasms.set_chunk_hashes(canister_type, Vec::new());
            }
        }
        state.env.canister_id()
    });

    match clear_chunk_store(canister_id).await {
        Ok(()) => info!("Chunk store cleared"),
        // The chunks are uploaded again regardless, since uploading a chunk already in the store
        // is a no-op
        Err(error) => error!(?error, "Failed to clear chunk store"),
    }

    for canister_type in CHILD_CANISTER_TYPES {
        upload_chunks(canister_id, canister_type).await;
    }
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
