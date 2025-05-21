use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{Data, read_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use rand::RngCore;
use stable_memory::get_reader;
use tracing::info;
use types::IdempotentEnvelope;
use utils::env::Environment;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    data.user_event_sync_queue.set_defer_processing(true);
    data.local_user_index_event_sync_queue.set_defer_processing(true);
    data.local_user_index_event_sync_queue
        .set_state(data.local_user_index_canister_id);

    let mut env = init_env(data.rng_seed);
    let now = env.now();
    #[expect(deprecated)]
    let events = data.event_store_client.take_events();
    data.local_user_index_event_sync_queue.push_many(
        events
            .into_iter()
            .map(|event| IdempotentEnvelope {
                created_at: now,
                idempotency_id: env.rng().next_u64(),
                value: local_user_index_canister::GroupEvent::EventStoreEvent(event.into()),
            })
            .collect(),
    );

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });
}
