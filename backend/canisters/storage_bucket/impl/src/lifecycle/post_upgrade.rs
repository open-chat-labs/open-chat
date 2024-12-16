use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::model::index_event_batch::EventToSync;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use storage_bucket_canister::post_upgrade::Args;
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    data.index_event_sync_queue.set_defer_processing(true);
    #[allow(deprecated)]
    {
        if let Some(args) = data.index_sync_state.args_to_retry.take() {
            for added in args.files_added {
                data.push_event_to_index(EventToSync::FileAdded(added));
            }
            for removed in args.files_removed {
                data.push_event_to_index(EventToSync::FileRemoved(removed));
            }
        }
        for event in std::mem::take(&mut data.index_sync_state.queue) {
            data.push_event_to_index(event)
        }
    }
    data.index_event_sync_queue.set_defer_processing(false);

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
