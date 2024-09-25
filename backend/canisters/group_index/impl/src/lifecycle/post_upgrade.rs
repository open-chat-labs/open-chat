use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use group_index_canister::ChildCanisterType;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use types::ChildCanisterWasms;
use utils::consts::DEV_TEAM_DFX_PRINCIPAL;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        state.data.child_canister_wasms = ChildCanisterWasms::new(vec![
            (
                ChildCanisterType::LocalGroupIndex,
                state.data.local_group_index_canister_wasm.clone(),
            ),
            (ChildCanisterType::Group, state.data.group_canister_wasm.clone()),
            (ChildCanisterType::Community, state.data.community_canister_wasm.clone()),
        ]);
        state.data.upload_wasm_chunks_whitelist.push(DEV_TEAM_DFX_PRINCIPAL);
    });
}
