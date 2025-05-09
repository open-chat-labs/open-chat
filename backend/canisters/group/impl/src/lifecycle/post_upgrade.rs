use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{Data, read_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use constants::MINUTE_IN_MS;
use event_store_producer::{EventBuilder, EventStoreClientBuilder};
use event_store_producer_cdk_runtime::CdkRuntime;
use group_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    let events = data.event_store_client.take_events();
    data.event_store_client = EventStoreClientBuilder::new(data.local_user_index_canister_id, CdkRuntime::default())
        .with_flush_delay(Duration::from_millis(5 * MINUTE_IN_MS))
        .build();

    data.event_store_client.push_many(
        events.into_iter().map(|e| {
            EventBuilder::new(e.name, e.timestamp)
                .with_maybe_user(
                    e.user.as_ref().map(|u| u.as_str().to_string()),
                    e.user.is_some_and(|u| !u.is_public()),
                )
                .with_maybe_source(
                    e.source.as_ref().map(|s| s.as_str().to_string()),
                    e.source.is_some_and(|s| !s.is_public()),
                )
                .with_payload(e.payload)
                .build()
        }),
        false,
    );

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
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
