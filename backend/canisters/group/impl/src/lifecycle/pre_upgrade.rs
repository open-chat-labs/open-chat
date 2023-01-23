use crate::lifecycle::UPGRADE_BUFFER_SIZE;
use crate::take_state;
use canister_tracing_macros::trace;
use ic_cdk_macros::pre_upgrade;
use stable_memory::serialize_to_stable_memory;
use tracing::info;

#[pre_upgrade]
#[trace]
fn pre_upgrade() {
    info!("Pre-upgrade starting");

    let state = take_state();
    let logs = canister_logger::export_logs();
    let traces = canister_logger::export_traces();

    let stable_state = (state.data, logs, traces);

    serialize_to_stable_memory(stable_state, UPGRADE_BUFFER_SIZE).unwrap();
}
