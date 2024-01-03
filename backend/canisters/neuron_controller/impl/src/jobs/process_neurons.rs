use crate::updates::manage_nns_neuron::manage_nns_neuron_impl;
use crate::{mutate_state, read_state};
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
use nns_governance_canister::types::manage_neuron::{Command, Disburse, Spawn};
use nns_governance_canister::types::ListNeurons;
use std::time::Duration;
use types::{Milliseconds, Timestamped};
use utils::canister_timers::run_now_then_interval;
use utils::consts::SNS_GOVERNANCE_CANISTER_ID;
use utils::time::DAY_IN_MS;

const REFRESH_NEURONS_INTERVAL: Milliseconds = DAY_IN_MS;
const E8S_PER_ICP: u64 = 100_000_000;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(REFRESH_NEURONS_INTERVAL), run);
}

fn run() {
    ic_cdk::spawn(run_async());
}

async fn run_async() {
    let nns_governance_canister_id = read_state(|state| state.data.nns_governance_canister_id);

    if let Ok(response) = nns_governance_canister_c2c_client::list_neurons(
        nns_governance_canister_id,
        &ListNeurons {
            neuron_ids: Vec::new(),
            include_neurons_readable_by_caller: true,
        },
    )
    .await
    {
        let now = read_state(|state| state.env.now());

        let neurons_to_spawn: Vec<_> = response
            .full_neurons
            .iter()
            .filter(|n| n.maturity_e8s_equivalent > 1000 * E8S_PER_ICP)
            .filter_map(|n| n.id.as_ref().map(|id| id.id))
            .collect();

        let neurons_to_disburse: Vec<_> = response
            .full_neurons
            .iter()
            .filter(|n| n.is_dissolved(now) && n.cached_neuron_stake_e8s > 0)
            .filter_map(|n| n.id.as_ref().map(|id| id.id))
            .collect();

        mutate_state(|state| {
            state.data.neurons = Timestamped::new(response.full_neurons, now);
        });

        if !neurons_to_spawn.is_empty() {
            spawn_neurons(neurons_to_spawn).await;
        }

        if !neurons_to_disburse.is_empty() {
            disburse_neurons(neurons_to_disburse).await;
        }
    }
}

async fn spawn_neurons(neuron_ids: Vec<u64>) {
    let cycles_minting_canister_id = read_state(|state| state.data.cycles_minting_canister_id);

    if let Ok(Ok(modulation)) = cycles_minting_canister_c2c_client::neuron_maturity_modulation(cycles_minting_canister_id).await
    {
        // Only spawn when the modulation is at least 102.5%
        if modulation >= 250 {
            for neuron_id in neuron_ids {
                manage_nns_neuron_impl(neuron_id, Command::Spawn(Spawn::default())).await;
            }
        }
    }
}

async fn disburse_neurons(neuron_ids: Vec<u64>) {
    for neuron_id in neuron_ids {
        manage_nns_neuron_impl(
            neuron_id,
            Command::Disburse(Disburse {
                to_account: Some(AccountIdentifier::new(&SNS_GOVERNANCE_CANISTER_ID, &DEFAULT_SUBACCOUNT)),
                amount: None,
            }),
        )
        .await;
    }
}
