use crate::Data;
use crate::lifecycle::init_state;
use crate::memory::get_upgrades_memory;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use identity_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    for canister_id in [
        "2notu-qyaaa-aaaar-qaeha-cai", // SignInWithEth
        "4s357-zaaaa-aaaaf-bjz7q-cai", // SignInWithEthTest
        "2kpva-5aaaa-aaaar-qaehq-cai", // SignInWithSol
        "lix6w-ciaaa-aaaaf-bj2aa-cai", // SignInWithSolTest
    ]
    .into_iter()
    .map(|s| CanisterId::from_text(s).unwrap())
    {
        data.originating_canisters.remove(&canister_id);
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
