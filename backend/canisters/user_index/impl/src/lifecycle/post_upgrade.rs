use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::{DeleteUser, Event};
use stable_memory::get_reader;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        for user_id in std::mem::take(&mut state.data.empty_users) {
            if let Some(canister_id) = state.data.local_index_map.get_index_canister(&user_id) {
                state.data.user_index_event_sync_queue.push(
                    canister_id,
                    Event::DeleteUser(DeleteUser {
                        user_id,
                        triggered_by_user: false,
                    }),
                );
            }
        }
        crate::jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);
    })
}
