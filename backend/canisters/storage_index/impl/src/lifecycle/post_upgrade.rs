use crate::Data;
use crate::lifecycle::{init_cycles_dispenser_client, init_env, init_state};
use crate::memory::get_upgrades_memory;
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use storage_index_canister::post_upgrade::Args;
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    // One-off: let the prod GroupIndex remove the files sent in deleted groups and communities. The
    // prod StorageIndex was installed with only the UserIndex as a user controller.
    // TODO remove after the release containing this has been deployed
    if !data.test_mode {
        data.user_controllers
            .insert(Principal::from_text("4ijyc-kiaaa-aaaaf-aaaja-cai").unwrap());
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(
        data.cycles_dispenser_config.canister_id,
        data.cycles_dispenser_config.min_cycles_balance,
    );

    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
