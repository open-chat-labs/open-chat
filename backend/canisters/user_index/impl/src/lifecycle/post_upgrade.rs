use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data, ONE_GB, ONE_MB};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::collections::BTreeMap;
use storage_index_canister::add_or_update_users::UserConfig;
use tracing::info;
use types::CanisterId;
use user_index_canister::post_upgrade::Args;
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

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());

    let mut user_id_lengths: BTreeMap<usize, usize> = BTreeMap::new();
    let now = env.now();
    data.storage_index_user_sync_queue.set_defer_processing(true);
    for user in data.users.iter() {
        let length = user.user_id.as_slice().len();
        *user_id_lengths.entry(length).or_default() += 1;

        data.storage_index_user_sync_queue.push(
            data.storage_index_canister_id,
            UserConfig {
                user_id: user.principal,
                byte_limit: if user.diamond_membership_details.is_active(now) { ONE_GB } else { 100 * ONE_MB },
            },
        );
    }
    data.storage_index_user_sync_queue.set_defer_processing(false);

    info!(?user_id_lengths, "UserId lengths");

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        if state.data.test_mode {
            state.data.website_canister_id = CanisterId::from_text("pfs7b-iqaaa-aaaaf-abs7q-cai").unwrap();
        }
    })
}
