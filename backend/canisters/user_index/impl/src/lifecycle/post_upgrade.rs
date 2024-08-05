use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::Cryptocurrency;
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

    ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::spawn(transfer_to_airdrop_bot()));
}

async fn transfer_to_airdrop_bot() {
    let (airdrop_bot, test_mode) = read_state(|state| (state.data.airdrop_bot_canister_id, state.data.test_mode));

    const ONE_CHAT: u64 = 1_0000_0000;
    let amount = if test_mode { ONE_CHAT } else { 100_000 * ONE_CHAT };

    let _ = icrc_ledger_canister_c2c_client::icrc1_transfer(
        Cryptocurrency::CHAT.ledger_canister_id().unwrap(),
        &TransferArg {
            from_subaccount: None,
            to: Account::from(airdrop_bot),
            fee: None,
            created_at_time: None,
            memo: None,
            amount: amount.into(),
        },
    )
    .await;
}
