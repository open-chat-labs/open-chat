use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::model::index_event_batch::EventToSync;
use crate::Data;
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use storage_bucket_canister::post_upgrade::Args;
use tracing::info;
use types::{FileMetaData, FileRemoved};

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    // Defer processing so that the c2c call isn't attempted during post_upgrade
    data.index_event_sync_queue.set_defer_processing(true);

    // One time hack to push the memory sizes to the StorageIndex
    data.index_event_sync_queue.push(
        data.storage_index_canister_id,
        (
            EventToSync::FileRemoved(FileRemoved {
                file_id: 0,
                meta_data: FileMetaData {
                    owner: Principal::anonymous(),
                    created: 0,
                },
            }),
            data.files.total_file_bytes(),
        ),
    );

    data.index_event_sync_queue.set_defer_processing(false);

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
