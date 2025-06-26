use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::updates::upgrade_community_canister_wasm::upgrade_community_wasm_in_local_index;
use crate::updates::upgrade_group_canister_wasm::upgrade_group_wasm_in_local_index;
use crate::{Data, read_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::ChildCanisterType;
use group_index_canister::post_upgrade::Args;
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

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let canister_to_upgrade = CanisterId::from_text("aboy3-giaaa-aaaar-aaaaq-cai").unwrap();
    let upgrade_canister = data.local_index_map.contains_key(&canister_to_upgrade);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    if upgrade_canister {
        ic_cdk_timers::set_timer(Duration::ZERO, move || {
            ic_cdk::futures::spawn(upgrade_wasms_in_canister(canister_to_upgrade))
        });
    }
}

async fn upgrade_wasms_in_canister(canister_id: CanisterId) {
    let group_canister_wasm = read_state(|state| state.data.child_canister_wasms.get(ChildCanisterType::Group).clone());
    let _ =
        upgrade_group_wasm_in_local_index(canister_id, &group_canister_wasm.wasm, group_canister_wasm.wasm_hash, None).await;

    let community_canister_wasm = read_state(|state| state.data.child_canister_wasms.get(ChildCanisterType::Community).clone());
    let _ = upgrade_community_wasm_in_local_index(
        canister_id,
        &community_canister_wasm.wasm,
        community_canister_wasm.wasm_hash,
        None,
    )
    .await;
}
