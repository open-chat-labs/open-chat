use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::timer_job_types::DedupeMessageIdsJob;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_timer_jobs::Job;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::UserEvent;
use stable_memory::get_reader;
use tracing::info;
use user_canister::post_upgrade::Args;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    DedupeMessageIdsJob::default().execute();

    mutate_state(|state| {
        let blocked_users = state.data.blocked_users.value.clone();
        if !blocked_users.is_empty() {
            let now = state.env.now();

            state.data.local_user_index_event_sync_queue.set_defer_processing(true);
            for user_id in blocked_users {
                state.push_local_user_index_canister_event(UserEvent::UserBlocked(user_id), now);
            }
            state.data.local_user_index_event_sync_queue.set_defer_processing(false);
        }
    })
}
