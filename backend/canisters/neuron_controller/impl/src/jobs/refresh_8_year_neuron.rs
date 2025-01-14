use crate::read_state;
use constants::DAY_IN_MS;
use nns_governance_canister::types::manage_neuron::claim_or_refresh::By;
use nns_governance_canister::types::manage_neuron::{ClaimOrRefresh, Command};
use nns_governance_canister::types::neuron::DissolveState;
use nns_governance_canister::types::Empty;
use std::time::Duration;
use tracing::info;
use types::Milliseconds;
use utils::canister_timers::run_now_then_interval;

const REFRESH_NEURON_INTERVAL: Milliseconds = DAY_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(REFRESH_NEURON_INTERVAL), run);
}

fn run() {
    ic_cdk::spawn(run_async());
}

async fn run_async() {
    if let Some((nns_governance_canister_id, neuron_id)) = read_state(|state| {
        state
            .data
            .neurons
            .active_neurons
            .iter()
            .max_by_key(|n| {
                n.dissolve_state
                    .as_ref()
                    .map(|ds| if let DissolveState::DissolveDelaySeconds(dd) = ds { *dd } else { 0 })
            })
            .map(|n| (state.data.nns_governance_canister_id, n.id.clone()))
    }) {
        if nns_governance_canister_c2c_client::manage_neuron(
            nns_governance_canister_id,
            &nns_governance_canister::manage_neuron::Args {
                id: neuron_id.clone(),
                neuron_id_or_subaccount: None,
                command: Some(Command::ClaimOrRefresh(ClaimOrRefresh {
                    by: Some(By::NeuronIdOrSubaccount(Empty {})),
                })),
            },
        )
        .await
        .is_ok()
        {
            info!(?neuron_id, "Refreshed neuron");
        }
    }
}
