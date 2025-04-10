use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use ic_cdk::management_canister::DepositCyclesArgs;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::{error, info};
use utils::cycles::init_cycles_dispenser_client;

const T: u128 = 1_000_000_000_000;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    let cycles_balance = ic_cdk::api::canister_liquid_cycle_balance();
    let excess_cycles = cycles_balance.saturating_sub(200 * T);

    if excess_cycles > 0 {
        ic_cdk_timers::set_timer(Duration::ZERO, move || {
            ic_cdk::futures::spawn(transfer_excess_cycles(excess_cycles))
        });
    }
}

async fn transfer_excess_cycles(cycles: u128) {
    let cycles_dispenser_canister_id = read_state(|state| state.data.cycles_dispenser_canister_id);

    match ic_cdk::management_canister::deposit_cycles(
        &DepositCyclesArgs {
            canister_id: cycles_dispenser_canister_id,
        },
        cycles,
    )
    .await
    {
        Ok(_) => info!(cycles, "Transferred excess cycles to CyclesDispenser"),
        Err(error) => error!(?error, "Failed to transfer excess cycles to CyclesDispenser"),
    }
}
