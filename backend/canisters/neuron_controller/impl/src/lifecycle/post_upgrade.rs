use crate::ecdsa::make_canister_call_via_ecdsa;
use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use neuron_controller_canister::post_upgrade::Args;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use utils::consts::SNS_GOVERNANCE_CANISTER_ID;
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

    ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::spawn(transfer_to_treasury()));
}

async fn transfer_to_treasury() {
    let request = mutate_state(|state| {
        state.prepare_canister_call_via_ecdsa(
            state.data.nns_ledger_canister_id,
            "icrc1_transfer".to_string(),
            &TransferArg {
                from_subaccount: None,
                to: Account::from(SNS_GOVERNANCE_CANISTER_ID),
                fee: Some(10000u64.into()),
                created_at_time: None,
                memo: None,
                amount: 258592708008u64.into(),
            },
        )
    });

    let _ = make_canister_call_via_ecdsa(request).await;
}
