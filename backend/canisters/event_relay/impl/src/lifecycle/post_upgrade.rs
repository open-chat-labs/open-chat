use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use event_relay_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::{error, info};
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::spawn(sync_salt_to_event_store()));
}

async fn sync_salt_to_event_store() {
    let (event_store_canister_id, salt) = read_state(|state| {
        (
            state.data.event_store_client.info().event_store_canister_id,
            state.data.salt.get(),
        )
    });

    if let Err(error) = ic_cdk::call::<_, ()>(event_store_canister_id, "set_salt", (salt,)).await {
        error!("Failed to sync salt to event store. Error: {error:?}")
    } else {
        info!("Salt synced to event store");
    }
}
