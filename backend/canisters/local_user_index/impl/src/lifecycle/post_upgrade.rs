use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::api::management_canister::main::{CanisterSettings, UpdateSettingsArgument};
use ic_cdk::post_upgrade;
use local_user_index_canister::post_upgrade::Args;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::CanisterId;
use utils::consts::DEV_TEAM_DFX_PRINCIPAL;
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

    ic_cdk_timers::set_timer(Duration::ZERO, || {
        ic_cdk::spawn(add_oc_dev_team_as_controller_to_2_uninstalled_canisters())
    });
}

async fn add_oc_dev_team_as_controller_to_2_uninstalled_canisters() {
    let canisters = vec![
        CanisterId::from_text("plfbt-7aaaa-aaaar-a3dga-cai").unwrap(),
        CanisterId::from_text("6uvp5-wqaaa-aaaar-arjcq-cai").unwrap(),
    ];

    for canister in canisters {
        ic_cdk::api::management_canister::main::update_settings(UpdateSettingsArgument {
            canister_id: canister,
            settings: CanisterSettings {
                controllers: Some(vec![ic_cdk::id(), DEV_TEAM_DFX_PRINCIPAL]),
                ..Default::default()
            },
        })
        .await
        .unwrap()
    }
}
