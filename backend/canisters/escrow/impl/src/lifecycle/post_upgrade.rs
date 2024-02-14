use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::Data;
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use escrow_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use icrc_ledger_types::icrc1::transfer::TransferArg;
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
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::spawn(refund_sneed()));
}

async fn refund_sneed() {
    let sneed_ledger = CanisterId::from_text("r7cp6-6aaaa-aaaag-qco5q-cai").unwrap();

    let _ = icrc_ledger_canister_c2c_client::icrc1_transfer(
        sneed_ledger,
        &TransferArg {
            from_subaccount: Some(
                hex::decode("c37c2e0eeb36394cca8cc735c34ce577885180e76b489918fab97f7ca37de73c")
                    .unwrap()
                    .try_into()
                    .unwrap(),
            ),
            to: Principal::from_text("vfhvn-qyaaa-aaaaf-adoxa-cai").unwrap().into(),
            fee: None,
            created_at_time: None,
            memo: None,
            amount: (10_000_000_000u64 - 100_000_000).into(),
        },
    )
    .await;

    let _ = icrc_ledger_canister_c2c_client::icrc1_transfer(
        sneed_ledger,
        &TransferArg {
            from_subaccount: Some(
                hex::decode("52f2f597bd96647b71742ad6b1763c90e80b092ba25ea2e909167d9cffc37963")
                    .unwrap()
                    .try_into()
                    .unwrap(),
            ),
            to: Principal::from_text("mzhg4-fqaaa-aaaar-ay7iq-cai").unwrap().into(),
            fee: None,
            created_at_time: None,
            memo: None,
            amount: (250_000_000_000u64 - 100_000_000).into(),
        },
    )
    .await;
}
