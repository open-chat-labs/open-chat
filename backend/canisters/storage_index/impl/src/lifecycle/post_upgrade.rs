use crate::lifecycle::{init_cycles_dispenser_client, init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::api::management_canister::main::{CanisterSettings, UpdateSettingsArgument};
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use storage_index_canister::post_upgrade::Args;
use tracing::info;
use types::CanisterId;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(
        data.cycles_dispenser_config.canister_id,
        data.cycles_dispenser_config.min_cycles_balance,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::ZERO, || {
        ic_cdk::spawn(increase_heap_memory_limit(
            CanisterId::from_text("6xr54-haaaa-aaaap-qhotq-cai").unwrap(),
        ))
    });
}

async fn increase_heap_memory_limit(canister_id: CanisterId) {
    const HALF_GB: u128 = 512 * 1024 * 1024;

    ic_cdk::api::management_canister::main::update_settings(UpdateSettingsArgument {
        canister_id,
        settings: CanisterSettings {
            wasm_memory_limit: Some((7 * HALF_GB).into()), // 3.5 GB
            ..Default::default()
        },
    })
    .await
    .unwrap()
}
