use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::CanisterId;
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

    ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::spawn(sync_deleted_users()));
}

async fn sync_deleted_users() {
    let (deleted_users, test_mode) = read_state(|state| {
        (
            state.data.deleted_users.iter().map(|u| u.user_id).collect(),
            state.data.test_mode,
        )
    });

    let local_group_indexes = if test_mode {
        vec![CanisterId::from_text("sbhuw-gyaaa-aaaaf-bfynq-cai").unwrap()]
    } else {
        vec![
            CanisterId::from_text("suaf3-hqaaa-aaaaf-bfyoa-cai").unwrap(),
            CanisterId::from_text("ainth-qaaaa-aaaar-aaaba-cai").unwrap(),
        ]
    };

    let args = local_group_index_canister::c2c_sync_deleted_users::Args { user_ids: deleted_users };

    for canister_id in local_group_indexes {
        let _ = local_group_index_canister_c2c_client::c2c_sync_deleted_users(canister_id, &args).await;
    }
}
