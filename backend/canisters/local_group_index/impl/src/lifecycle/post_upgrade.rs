use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::api::management_canister::main::{CanisterSettings, LogVisibility, UpdateSettingsArgument};
use ic_cdk::post_upgrade;
use local_group_index_canister::post_upgrade::Args;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::CanisterId;
use utils::canister::deposit_cycles;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::ZERO, || {
        ic_cdk::spawn(increase_windoge_reserved_cycles_limit_public())
    });
}

async fn increase_windoge_reserved_cycles_limit_public() {
    let windoge_canister_id = CanisterId::from_text("ow6el-gyaaa-aaaar-av5na-cai").unwrap();

    ic_cdk::api::management_canister::main::update_settings(UpdateSettingsArgument {
        canister_id: windoge_canister_id,
        settings: CanisterSettings {
            reserved_cycles_limit: Some(20_000_000_000_000.into()),
            ..Default::default()
        },
    })
    .await
    .unwrap();

    deposit_cycles(windoge_canister_id, 20_000_000_000_000.into()).await.unwrap();
}
