use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use tracing::{error, info};
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
        let users_with_duplicate_usernames: Vec<_> = state
            .data
            .users
            .users_with_duplicate_usernames
            .iter()
            .map(|(u1, u2)| (u1.to_string(), u2.to_string()))
            .collect();

        let users_with_duplicate_principals: Vec<_> = state
            .data
            .users
            .users_with_duplicate_principals
            .iter()
            .map(|(u1, u2)| (u1.to_string(), u2.to_string()))
            .collect();

        if !users_with_duplicate_usernames.is_empty() {
            error!(?users_with_duplicate_usernames);
        }

        if !users_with_duplicate_principals.is_empty() {
            error!(?users_with_duplicate_principals);
        }

        state
            .data
            .legacy_principals_sync_queue
            .extend(state.data.users.iter().filter(|u| !u.is_bot).map(|u| u.principal));

        crate::jobs::sync_legacy_user_principals::start_job_if_required(state);
    })
}
