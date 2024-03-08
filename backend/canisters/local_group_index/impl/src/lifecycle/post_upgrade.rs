use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use local_group_index_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
use utils::canister::should_perform_upgrade;
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
        state.data.communities_requiring_upgrade.clear();
        let version = state.data.community_canister_wasm_for_upgrades.wasm.version;
        for canister_id in state
            .data
            .local_communities
            .iter()
            .filter(|(_, community)| should_perform_upgrade(community.wasm_version, version, state.data.test_mode))
            .map(|(community_id, _)| CanisterId::from(*community_id))
        {
            state.data.communities_requiring_upgrade.enqueue(canister_id, false);
        }
    })
}
