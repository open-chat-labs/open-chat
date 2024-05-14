use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use types::UserId;
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

    let failed_migrations: Vec<_> = [
        "zx4ws-zqaaa-aaaar-adsuq-cai",
        "reinb-hiaaa-aaaaf-atafq-cai",
        "zpwzy-wyaaa-aaaaf-bdezq-cai",
        "st3dj-diaaa-aaaaf-azwfq-cai",
        "txwm3-2iaaa-aaaaf-azwdq-cai",
    ]
    .into_iter()
    .map(|str| UserId::from(Principal::from_text(str).unwrap()))
    .collect();

    mutate_state(|state| {
        for user_id in failed_migrations {
            if let Some(user) = state.data.users.get_by_user_id(&user_id) {
                state.data.legacy_principals_sync_queue.push_back(user.principal);
            }
        }
        crate::jobs::sync_legacy_user_principals::start_job_if_required(state);
    });
}
