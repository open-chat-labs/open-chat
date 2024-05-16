use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use identity_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
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
        let mut canister_ids = vec!["rdmx6-jaaaa-aaaaa-aaadq-cai"]; // II

        let canister_id = state.env.canister_id();
        if canister_id == CanisterId::from_text("6klfq-niaaa-aaaar-qadbq-cai").unwrap() {
            canister_ids.push("zi2i7-nqaaa-aaaar-qaemq-cai"); // Email
            canister_ids.push("2notu-qyaaa-aaaar-qaeha-cai"); // ETH
            canister_ids.push("2kpva-5aaaa-aaaar-qaehq-cai"); // SOL
        } else if canister_id == CanisterId::from_text("").unwrap() {
            canister_ids.push("rubs2-eaaaa-aaaaf-bijfq-cai"); // Email
            canister_ids.push("2notu-qyaaa-aaaar-qaeha-cai"); // ETH
            canister_ids.push("2kpva-5aaaa-aaaar-qaehq-cai"); // SOL
        }

        for canister_id in canister_ids {
            state
                .data
                .skip_captcha_whitelist
                .insert(CanisterId::from_text(canister_id).unwrap());
        }
    });
}
