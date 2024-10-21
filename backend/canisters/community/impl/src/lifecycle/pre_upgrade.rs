use crate::memory::get_upgrades_memory;
use crate::take_state;
use canister_tracing_macros::trace;
use ic_cdk::pre_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use rand::Rng;
use stable_memory::get_writer;
use tracing::info;

#[pre_upgrade]
#[trace]
fn pre_upgrade() {
    info!("Pre-upgrade starting");

    let mut state = take_state();
    state.data.rng_seed = state.env.rng().gen();

    let errors = canister_logger::export_errors();
    let logs = canister_logger::export_logs();
    let traces = canister_logger::export_traces();

    let stable_state = (&state.data, errors, logs, traces);

    let mut memory = get_upgrades_memory();
    let writer = get_writer(&mut memory);

    msgpack::serialize(stable_state, writer).unwrap();

    let now = state.env.now();
    state
        .data
        .record_instructions_count(InstructionCountFunctionId::PreUpgrade, now);
}
