use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{Data, read_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use notifications_index_canister::post_upgrade::Args;
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionAdded};
use rand::RngCore;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, IdempotentEnvelope};
use utils::cycles::init_cycles_dispenser_client;
use utils::env::Environment;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let mut env = init_env(data.rng_seed);

    if data.local_indexes.is_empty() {
        let canister_id = env.canister_id();
        if canister_id == CanisterId::from_text("4glvk-ryaaa-aaaaf-aaaia-cai").unwrap() {
            data.local_indexes
                .insert(CanisterId::from_text("nq4qv-wqaaa-aaaaf-bhdgq-cai").unwrap());
            data.local_indexes
                .insert(CanisterId::from_text("aboy3-giaaa-aaaar-aaaaq-cai").unwrap());
            data.local_indexes
                .insert(CanisterId::from_text("lyt4m-myaaa-aaaac-aadkq-cai").unwrap());
        } else if canister_id == CanisterId::from_text("7ekiy-aiaaa-aaaaf-ab2dq-cai").unwrap() {
            data.local_indexes
                .insert(CanisterId::from_text("pecvb-tqaaa-aaaaf-bhdiq-cai").unwrap());
        } else {
            panic!("Canister not recognised");
        }
    }

    let mut events = Vec::new();
    for (user_id, subscriptions) in data.subscriptions.iter() {
        for subscription in subscriptions.iter().cloned() {
            events.push(NotificationsIndexEvent::SubscriptionAdded(SubscriptionAdded {
                user_id: *user_id,
                subscription,
            }));
        }
    }

    let now = env.now();
    data.local_index_event_sync_queue.set_defer_processing(true);
    for index in data.local_indexes.iter() {
        data.local_index_event_sync_queue.push_many(
            *index,
            events
                .iter()
                .map(|e| IdempotentEnvelope {
                    created_at: now,
                    idempotency_id: env.rng().next_u64(),
                    value: e.clone(),
                })
                .collect(),
        )
    }
    data.local_index_event_sync_queue.set_defer_processing(false);

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::ZERO, sync_blocked_users);
}

fn sync_blocked_users() {
    let (blocked_users, user_index_canister_id) =
        read_state(|state| (state.data.blocked_users.collect_all(), state.data.user_index_canister_id));

    ic_cdk::futures::spawn(async move {
        user_index_canister_c2c_client::c2c_sync_blocked_users(
            user_index_canister_id,
            &user_index_canister::c2c_sync_blocked_users::Args { blocked_users },
        )
        .await
        .unwrap();
    });
}
