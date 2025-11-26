use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use identity_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    // TODO: Remove this once the canister has been upgraded
    if data.test_mode {
        data.sign_in_with_email_canister_id = Principal::from_text("rubs2-eaaaa-aaaaf-bijfq-cai").unwrap()
    } else {
        data.sign_in_with_email_canister_id = Principal::from_text("zi2i7-nqaaa-aaaar-qaemq-cai").unwrap()
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
