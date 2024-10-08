use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::Data;
use airdrop_bot_canister::post_upgrade::Args;
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use icrc_ledger_canister::icrc1_transfer;
use ledger_utils::convert_to_subaccount;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::Cryptocurrency::CHAT;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::spawn(refund_user()));
}

async fn refund_user() {
    let principal = Principal::from_text("ioprk-aqaaa-aaaaf-atcza-cai").unwrap();
    let _ = icrc_ledger_canister_c2c_client::icrc1_transfer(
        CHAT.ledger_canister_id().unwrap(),
        &icrc1_transfer::Args {
            from_subaccount: Some(convert_to_subaccount(&principal).0),
            to: principal.into(),
            fee: None,
            created_at_time: None,
            memo: None,
            amount: 1825800000u64.into(),
        },
    )
    .await;
}
