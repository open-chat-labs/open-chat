use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{jobs, mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use local_user_index_canister::Event;
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

    // Post upgrade - remove
    mutate_state(|state| {
        if !state.data.legacy_principals_synced && state.data.test_mode {
            state.data.legacy_principals_synced = true;
            state
                .data
                .legacy_principals_sync_queue
                .extend(state.data.users.iter().map(|u| u.principal));

            crate::jobs::sync_legacy_user_principals::start_job_if_required(state);
        }

        let event = Event::SecretKeySet(state.data.oc_key_pair.secret_key_der().to_vec());
        for canister_id in state.data.local_index_map.canisters() {
            state.data.user_index_event_sync_queue.push(*canister_id, event.clone());
        }
        jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);
    });
}
