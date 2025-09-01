use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use registry_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::Environment;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);

    data.tokens.update(
        registry_canister::update_token::Args {
            ledger_canister_id: CanisterId::from_text("53nhb-haaaa-aaaar-qbn5q-cai").unwrap(),
            transaction_url_format: Some(
                "https://dashboard.internetcomputer.org/tokens/53nhb-haaaa-aaaar-qbn5q-cai/transaction/{transaction_index}"
                    .to_string(),
            ),
            name: None,
            symbol: None,
            info_url: None,
            logo: None,
            fee: None,
        },
        env.now(),
    );

    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
