use crate::updates::manage_nns_neuron::manage_nns_neuron_impl;
use crate::{mutate_state, read_state, Neurons};
use constants::{DAY_IN_MS, MINUTE_IN_MS, SNS_GOVERNANCE_CANISTER_ID};
use ic_cdk::call::RejectCode;
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
use icrc_ledger_types::icrc1::account::Account;
use nns_governance_canister::types::manage_neuron::{Command, Disburse, Spawn};
use nns_governance_canister::types::neuron::DissolveState;
use nns_governance_canister::types::ListNeurons;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, Milliseconds};
use utils::canister_timers::run_now_then_interval;

// We add a minute because spawning takes 7 days, and if we wait exactly 7 days, there may still be a few seconds left
// before the neuron can be spawned
const REFRESH_NEURONS_INTERVAL: Milliseconds = DAY_IN_MS + MINUTE_IN_MS;
const E8S_PER_ICP: u64 = 100_000_000;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(REFRESH_NEURONS_INTERVAL), run);
}

fn run() {
    ic_cdk::futures::spawn(run_async());
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
        // Neurons can vote if their dissolve delay is >= 6 months, but when they start dissolving
        // they can still earn maturity for a few days as the rewards are distributed for
        // proposals they have already voted on.
        // Hence, this is set to 6 months minus a few days.
        let cut_off_no_longer_accrue_maturity = now.saturating_sub(175 * DAY_IN_MS);

        let neurons_to_spawn: Vec<_> = response
            .full_neurons
            .iter()
            .filter(|n| n.spawn_at_timestamp_seconds.is_none() && n.maturity_e8s_equivalent > E8S_PER_ICP)
            .filter(|n| {
                // Spawn a new neuron if there is over 1000 ICP maturity or
                // if the neuron is now dissolving and can no longer vote
                n.maturity_e8s_equivalent > 1000 * E8S_PER_ICP
                    || n.dissolve_state.as_ref().is_some_and(
                        |ds| matches!(ds, DissolveState::WhenDissolvedTimestampSeconds(ts) if *ts < cut_off_no_longer_accrue_maturity),
                    )
            })
            .filter_map(|n| n.id.as_ref().map(|id| id.id))
            .collect();

        let neurons_to_disburse: Vec<_> = response
            .full_neurons
            .iter()
            .filter(|n| n.is_dissolved(now) && n.cached_neuron_stake_e8s > 0)
            .filter_map(|n| n.id.as_ref().map(|id| id.id))
            .collect();

        mutate_state(|state| {
            let mut active_neurons = Vec::new();
            let mut spawning_neurons = Vec::new();
            let mut disbursed_neurons = Vec::new();
            for neuron in response.full_neurons.into_iter() {
                if neuron.maturity_e8s_equivalent == 0 && neuron.cached_neuron_stake_e8s == 0 {
                    if let Some(neuron_id) = neuron.id {
                        disbursed_neurons.push(neuron_id.id);
                    }
                } else if neuron.spawn_at_timestamp_seconds.is_some() {
                    spawning_neurons.push(neuron);
                } else {
                    active_neurons.push(neuron);
                }
            }

            state.data.neurons = Neurons {
                timestamp: now,
                active_neurons,
                spawning_neurons,
                disbursed_neurons,
            }
        });

        let mut neurons_updated = false;
        if !neurons_to_spawn.is_empty() {
            let any_spawned = spawn_neurons(neurons_to_spawn).await;
            if any_spawned {
                neurons_updated = true;
            }
        }

        if !neurons_to_disburse.is_empty() {
            disburse_neurons(neurons_to_disburse).await;
            neurons_updated = true;
        }

        if neurons_updated {
            // Refresh the neurons again given that they've been updated
            ic_cdk_timers::set_timer(Duration::ZERO, run);
        }
    }
}

async fn spawn_neurons(neuron_ids: Vec<u64>) -> bool {
    let (nns_ledger_canister_id, cycles_minting_canister_id, cycles_dispenser_canister_id) = read_state(|state| {
        (
            state.data.nns_ledger_canister_id,
            state.data.cycles_minting_canister_id,
            state.data.cycles_dispenser_canister_id,
        )
    });

    let is_cycles_dispenser_low = is_cycles_dispenser_balance_low(nns_ledger_canister_id, cycles_dispenser_canister_id)
        .await
        .unwrap_or(true);

    let is_modulation_high = cycles_minting_canister_c2c_client::neuron_maturity_modulation(cycles_minting_canister_id)
        .await
        .map(|response| response.unwrap_or_default() > 250)
        .unwrap_or_default();

    if is_cycles_dispenser_low || is_modulation_high {
        for neuron_id in neuron_ids {
            info!(neuron_id, "Spawning neuron from maturity");
            manage_nns_neuron_impl(neuron_id, Command::Spawn(Spawn::default())).await;
        }
        true
    } else {
        false
    }
}

async fn disburse_neurons(neuron_ids: Vec<u64>) {
    let (nns_ledger_canister_id, cycles_dispenser_canister_id) =
        read_state(|state| (state.data.nns_ledger_canister_id, state.data.cycles_dispenser_canister_id));

    // If the CyclesDispenser has less than 10000 ICP, top it up, otherwise send the ICP to the treasury
    let mut top_up_cycles_dispenser = is_cycles_dispenser_balance_low(nns_ledger_canister_id, cycles_dispenser_canister_id)
        .await
        .unwrap_or(true);

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
                amount: None,
            }),
        )
        .await;
    }
}

async fn is_cycles_dispenser_balance_low(
    nns_ledger_canister_id: CanisterId,
    cycles_dispenser_canister_id: CanisterId,
) -> Result<bool, (RejectCode, String)> {
    icrc_ledger_canister_c2c_client::icrc1_balance_of(nns_ledger_canister_id, &Account::from(cycles_dispenser_canister_id))
        .await
        .map(|balance| balance < 10000 * E8S_PER_ICP)
}
