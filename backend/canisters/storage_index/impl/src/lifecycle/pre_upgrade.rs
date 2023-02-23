use crate::lifecycle::BUFFER_SIZE;
use crate::memory::get_upgrades_memory;
use crate::take_state;
use canister_tracing_macros::trace;
use ic_cdk_macros::pre_upgrade;
use ic_stable_structures::writer::{BufferedWriter, Writer};
use tracing::info;

#[pre_upgrade]
#[trace]
fn pre_upgrade() {
    info!("Pre-upgrade starting");

    let state = take_state();
    let logs = canister_logger::export_logs();
    let traces = canister_logger::export_traces();

    let stable_state = (state.data, logs, traces);

    let mut memory = get_upgrades_memory();
    let writer = BufferedWriter::new(BUFFER_SIZE, Writer::new(&mut memory, 0));

    serializer::serialize(stable_state, writer).unwrap();
}
