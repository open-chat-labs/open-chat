use crate::updates::manage_nns_neuron::manage_nns_neuron_impl;
use crate::{mutate_state, read_state, Neurons};
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
use icrc_ledger_types::icrc1::account::Account;
use nns_governance_canister::types::manage_neuron::disburse::Amount;
use nns_governance_canister::types::manage_neuron::{Command, Disburse, Spawn};
use nns_governance_canister::types::ListNeurons;
use std::time::Duration;
use tracing::info;
use types::Milliseconds;
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
            let (active_neurons, disbursed_neurons): (Vec<_>, Vec<_>) = response
                .full_neurons
                .into_iter()
                .partition(|n| n.maturity_e8s_equivalent > 0 || n.cached_neuron_stake_e8s > 0);

            state.data.neurons = Neurons {
                timestamp: now,
                active_neurons,
                disbursed_neurons: disbursed_neurons
                    .into_iter()
                    .filter_map(|n| n.id.as_ref().map(|id| id.id))
                    .collect(),
            }
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
                info!(neuron_id, "Spawning neuron from maturity");
                manage_nns_neuron_impl(neuron_id, Command::Spawn(Spawn::default())).await;
            }
        }
    }
}

async fn disburse_neurons(neuron_ids: Vec<u64>) {
    let (nns_ledger_canister_id, cycles_dispenser_canister_id) =
        read_state(|state| (state.data.nns_ledger_canister_id, state.data.cycles_dispenser_canister_id));

    // If the CyclesDispenser has less than 1000 ICP, top it up, otherwise send the ICP to the treasury
    let mut top_up_cycles_dispenser =
        icrc_ledger_canister_c2c_client::icrc1_balance_of(nns_ledger_canister_id, &Account::from(cycles_dispenser_canister_id))
            .await
            .map(|r| r < 1000 * E8S_PER_ICP)
            .unwrap_or_default();

    for neuron_id in neuron_ids {
        info!(neuron_id, top_up_cycles_dispenser, "Disbursing neuron");

        let recipient_canister = if top_up_cycles_dispenser {
            // Set to false so that we only top it up once
            top_up_cycles_dispenser = false;
            cycles_dispenser_canister_id
        } else {
            SNS_GOVERNANCE_CANISTER_ID
        };

        let account = nns_governance_canister::types::AccountIdentifier {
            hash: AccountIdentifier::new(&recipient_canister, &DEFAULT_SUBACCOUNT)
                .as_ref()
                .to_vec(),
        };

        manage_nns_neuron_impl(
            neuron_id,
            Command::Disburse(Disburse {
                to_account: Some(account.clone()),
                amount: Some(Amount { e8s: E8S_PER_ICP }),
            }),
        )
        .await;
    }
}
