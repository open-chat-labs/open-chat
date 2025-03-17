use crate::read_state;
use constants::DAY_IN_MS;
use nns_governance_canister::types::manage_neuron::Command;
use nns_governance_canister::types::NeuronId;
use std::time::Duration;
use tracing::info;
use types::{Empty, Milliseconds};
use utils::canister_timers::run_now_then_interval;

const REFRESH_VOTING_POWER_INTERVAL: Milliseconds = 30 * DAY_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(REFRESH_VOTING_POWER_INTERVAL), || {
        ic_cdk::futures::spawn(run_async())
    });
}

async fn run_async() {
    let (nns_governance_canister_id, neurons_to_refresh) = read_state(|state| {
        let now = state.env.now();
        let cutoff = now.saturating_sub(90 * DAY_IN_MS);
        // Neuron voting power will be gradually reduced if the
        // `voting_power_refreshed_timestamp_seconds` value is more than 180 days in the past.
        // So we filter to neurons where it is at least 90 days in the past and then refresh the
        // voting power for those neurons.
        let neurons: Vec<_> = state
            .data
            .neurons
            .active_neurons
            .iter()
            .filter(|n| n.voting_power_refreshed_timestamp_seconds.is_none_or(|ts| ts < cutoff))
            .filter_map(|n| n.id.as_ref().map(|id| (id.id)))
            .collect();

        (state.data.nns_governance_canister_id, neurons)
    });

    for neuron_id in neurons_to_refresh {
        if nns_governance_canister_c2c_client::manage_neuron(
            nns_governance_canister_id,
            &nns_governance_canister::manage_neuron::Args {
                id: Some(NeuronId { id: neuron_id }),
                neuron_id_or_subaccount: None,
                command: Some(Command::RefreshVotingPower(Empty {})),
            },
        )
        .await
        .is_ok()
        {
            info!(?neuron_id, "Refreshed neuron voting power");
        }
    }
}
