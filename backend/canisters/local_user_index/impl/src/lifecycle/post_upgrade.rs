use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::Data;
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use local_user_index_canister::post_upgrade::Args;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    let refund_amount = match ic_cdk::id().to_string().as_str() {
        "aboy3-giaaa-aaaar-aaaaq-cai" => 192807666,
        "pecvb-tqaaa-aaaaf-bhdiq-cai" => 952,
        _ => 0,
    };

    if refund_amount > 0 {
        ic_cdk_timers::set_timer(Duration::ZERO, move || ic_cdk::spawn(refund_ckbtc(refund_amount)));
    }
}

async fn refund_ckbtc(amount: u128) {
    let transfer_arg = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: Principal::from_text("ifdcz-ditqo-tojui-ncj6w-tukjj-4ujn5-j5ibk-ksch7-abkr5-pd22f-fae").unwrap(),
            subaccount: None,
        },
        fee: Some(10.into()),
        created_at_time: None,
        memo: None,
        amount: amount.into(),
    };

    let _ = icrc_ledger_canister_c2c_client::icrc1_transfer(
        CanisterId::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap(),
        &transfer_arg,
    )
    .await;
}
