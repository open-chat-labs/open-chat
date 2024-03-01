use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use event_relay_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
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

    let local_user_indexes = vec!["nq4qv-wqaaa-aaaaf-bhdgq-cai", "aboy3-giaaa-aaaar-aaaaq-cai"];
    let local_group_indexes = vec!["suaf3-hqaaa-aaaaf-bfyoa-cai", "ainth-qaaaa-aaaar-aaaba-cai"];

    mutate_state(|state| {
        for principal in local_user_indexes
            .into_iter()
            .chain(local_group_indexes.into_iter())
            .map(|s| Principal::from_text(s).unwrap())
        {
            state.data.push_events_whitelist.insert(principal);
        }
    });
}
