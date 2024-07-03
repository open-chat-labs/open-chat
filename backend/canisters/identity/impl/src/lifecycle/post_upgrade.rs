use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use identity_canister::post_upgrade::Args;
use stable_memory::get_reader;
use std::collections::HashSet;
use tracing::info;
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

    mutate_state(|state| {
        // Remove ETH and SOL canisters from skip_captcha_whitelist
        let canisters_to_remove = HashSet::from([
            "2notu-qyaaa-aaaar-qaeha-cai".to_string(),
            "2kpva-5aaaa-aaaar-qaehq-cai".to_string(),
            "4s357-zaaaa-aaaaf-bjz7q-cai".to_string(),
            "lix6w-ciaaa-aaaaf-bj2aa-cai".to_string(),
        ]);

        state
            .data
            .skip_captcha_whitelist
            .retain(|e| !canisters_to_remove.contains(&e.to_string()));
    });
}
