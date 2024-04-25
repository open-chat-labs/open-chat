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

    let already_migrated = vec![
        "3skqk-iqaaa-aaaaf-aaa3q-cai",
        "27eue-hyaaa-aaaaf-aaa4a-cai",
        "2yfsq-kaaaa-aaaaf-aaa4q-cai",
    ];

    mutate_state(|state| {
        let now = state.env.now();
        for user_id in already_migrated
            .into_iter()
            .map(|s| UserId::from(Principal::from_text(s).unwrap()))
        {
            if let Some(mut user) = state.data.users.get_by_user_id(&user_id).cloned() {
                user.principal_migrated = true;
                state.data.users.update(user, now);
            }
        }
    })
}
