use crate::lifecycle::init_state;
use crate::memory::get_upgrades_memory;
use crate::{Data, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{AccessorId, CanisterId};
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    // One-off: record the StorageIndex canister id, which the GroupIndex wasn't installed with, then
    // queue the ids of the groups and communities deleted so far, so that the files sent in them are
    // removed. Queued from a timer because queueing them starts sending them, which makes c2c calls,
    // which can't be made from post_upgrade.
    // TODO remove after the release containing this has been deployed
    let backfill_deleted_chats = data.storage_index_canister_id == CanisterId::anonymous();
    if backfill_deleted_chats {
        let storage_index_canister_id =
            CanisterId::from_text(if data.test_mode { "6jemw-paaaa-aaaaf-ab2ea-cai" } else { "rturd-qaaaa-aaaaf-aabaq-cai" })
                .unwrap();
        data.storage_index_canister_id = storage_index_canister_id;
        data.storage_index_accessors_to_remove_queue
            .set_state(storage_index_canister_id);
    }

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    if backfill_deleted_chats {
        ic_cdk_timers::set_timer(Duration::ZERO, async {
            mutate_state(|state| {
                let accessor_ids = deleted_chat_accessor_ids(&state.data);
                info!(
                    count = accessor_ids.len(),
                    "Queued the deleted groups and communities to have their files removed"
                );
                state.data.storage_index_accessors_to_remove_queue.push_many(accessor_ids);
            });
        });
    }

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}

// The ids of the deleted groups and communities, which the files sent in them name as their only
// accessor. A group imported into a community lives on as one of its channels, so it is only included
// if the community has been deleted too.
fn deleted_chat_accessor_ids(data: &Data) -> Vec<AccessorId> {
    let groups = data
        .deleted_groups
        .iter()
        .filter(|g| {
            g.community_imported_into
                .as_ref()
                .is_none_or(|c| data.deleted_communities.get(&c.community_id).is_some())
        })
        .map(|g| g.id.into());

    let communities = data.deleted_communities.ids().map(|c| c.into());

    groups.chain(communities).collect()
}
