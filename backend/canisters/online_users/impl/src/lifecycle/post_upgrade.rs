use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use online_users_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    if data.test_mode {
        data.airdrop_bot_canister_id = CanisterId::from_text("6pwwx-laaaa-aaaaf-bmy6a-cai").unwrap();
    } else {
        data.airdrop_bot_canister_id = CanisterId::from_text("62rh2-kiaaa-aaaaf-bmy5q-cai").unwrap();
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
