use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::updates::unsuspend_user::unsuspend_user_impl;
use crate::Data;
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
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

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    let users_to_unsuspend: Vec<UserId> = [
        "qyzts-uiaaa-aaaar-aw4ca-cai",
        "zjayq-ryaaa-aaaar-axhrq-cai",
        "o6334-oyaaa-aaaar-awgxa-cai",
        "s4i57-nqaaa-aaaar-abzcq-cai",
        "vecg6-eqaaa-aaaar-a23rq-cai",
        "ne6gg-dqaaa-aaaaf-agzwa-cai",
    ]
    .iter()
    .map(|str| Principal::from_text(str).unwrap().into())
    .collect();

    ic_cdk_timers::set_timer(Duration::ZERO, || {
        ic_cdk::spawn(async move {
            futures::future::join_all(users_to_unsuspend.into_iter().map(unsuspend_user_impl)).await;
        })
    });
}
