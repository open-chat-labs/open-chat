use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::updates::set_community_or_group_verification::set_community_verification_impl;
use crate::{Data, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use ic_cdk::management_canister::{CanisterSettings, LogVisibility, UpdateSettingsArgs};
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    let test_mode = data.test_mode;
    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    if !test_mode {
        ic_cdk_timers::set_timer(Duration::ZERO, || {
            ic_cdk::futures::spawn(async move {
                ic_cdk::management_canister::update_settings(&UpdateSettingsArgs {
                    canister_id: ic_cdk::api::canister_self(),
                    settings: CanisterSettings {
                        log_visibility: Some(LogVisibility::Public),
                        ..Default::default()
                    },
                })
                .await
                .unwrap();

                mark_jade8_community_verified();
            })
        });
    }
}

fn mark_jade8_community_verified() {
    let community_id = CanisterId::from_text("siuvd-kiaaa-aaaaf-bm6oa-cai").unwrap().into();
    let args = group_index_canister::set_community_verification::Args {
        name: "JADE 8".into(),
        community_id,
    };

    let result = mutate_state(|state| set_community_verification_impl(args, state));
    info!(%community_id, ?result, "Set community verification completed");
}
