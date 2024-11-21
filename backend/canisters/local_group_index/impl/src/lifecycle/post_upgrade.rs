use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_group_index_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    if data.local_user_index_canister_id == CanisterId::from_text("nq4qv-wqaaa-aaaaf-bhdgq-cai").unwrap() {
        data.bot_api_gateway_canister_id = CanisterId::from_text("xdh4a-myaaa-aaaaf-bscya-cai").unwrap()
    } else if data.local_user_index_canister_id == CanisterId::from_text("aboy3-giaaa-aaaar-aaaaq-cai").unwrap() {
        data.bot_api_gateway_canister_id = CanisterId::from_text("lvpeh-caaaa-aaaar-boaha-cai").unwrap()
    } else if data.local_user_index_canister_id == CanisterId::from_text("pecvb-tqaaa-aaaaf-bhdiq-cai").unwrap() {
        data.bot_api_gateway_canister_id = CanisterId::from_text("xeg2u-baaaa-aaaaf-bscyq-cai").unwrap()
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
