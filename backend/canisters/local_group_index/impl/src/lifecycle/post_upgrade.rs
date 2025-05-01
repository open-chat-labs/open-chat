use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_group_index_canister::post_upgrade::Args;
use local_user_index_canister::LocalGroupIndexEvent;
use rand::RngCore;
use stable_memory::get_reader;
use tracing::info;
use types::{CanisterId, IdempotentEnvelope};
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

    let mut env = init_env(data.rng_seed);

    if !data.controllers_updated && data.update_controllers_queue.is_empty() {
        data.update_controllers_queue
            .extend(data.local_groups.iter().map(|(g, _)| CanisterId::from(*g)));
        data.update_controllers_queue
            .extend(data.local_communities.iter().map(|(c, _)| CanisterId::from(*c)));
    }

    data.local_user_index_sync_queue.set_defer_processing(true);
    data.local_user_index_sync_queue.set_state(data.local_user_index_canister_id);

    let now = env.now();
    for (chat_id, group) in data.local_groups.iter() {
        data.local_user_index_sync_queue.push(IdempotentEnvelope {
            created_at: now,
            idempotency_id: env.rng().next_u64(),
            value: LocalGroupIndexEvent::MigrateGroup(*chat_id, group.clone()),
        })
    }

    for (community_id, community) in data.local_communities.iter() {
        data.local_user_index_sync_queue.push(IdempotentEnvelope {
            created_at: now,
            idempotency_id: env.rng().next_u64(),
            value: LocalGroupIndexEvent::MigrateCommunity(*community_id, community.clone()),
        })
    }

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
