use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::UserIndexEvent;
use stable_memory::get_reader;
use stable_memory_map::StableMemoryMap;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    let blocked_users = data.blocked_users.collect_all();
    let blocked_users_len = data.blocked_users.len();

    let mut blocked_user_pairs = Vec::new();
    for (user_id, blocked_users) in blocked_users.iter() {
        for blocked in blocked_users {
            assert!(data.blocked_users.remove(&(*user_id, *blocked)).is_some());
        }
    }

    for (user_id, blocked_users) in blocked_users {
        for blocked in blocked_users {
            assert!(data.blocked_users.insert((blocked, user_id), ()).is_none());
            blocked_user_pairs.push((user_id, blocked));
        }
    }

    assert_eq!(blocked_users_len, data.blocked_users.len());

    for local_user_index in data.local_index_map.canisters().copied() {
        for (user_id, blocked) in blocked_user_pairs.iter().copied() {
            data.user_index_event_sync_queue
                .push(local_user_index, UserIndexEvent::UserBlocked(user_id, blocked));
        }
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
