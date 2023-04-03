use crate::model::initial_airdrop_queue::InitialAirdropEntry;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use ic_base_types::PrincipalId;
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk_timers::TimerId;
use ic_icrc1::endpoints::TransferArg;
use ic_icrc1::Account;
use ic_sns_governance::pb::v1::manage_neuron::claim_or_refresh::{By, MemoAndController};
use ic_sns_governance::pb::v1::manage_neuron::{ClaimOrRefresh, Command};
use ic_sns_governance::pb::v1::manage_neuron_response::Command as CommandResponse;
use ic_sns_governance::pb::v1::ManageNeuron;
use itertools::Itertools;
use sha2::{Digest, Sha256};
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{CanisterId, SnsNeuronId, TimestampMillis};

const MIN_NEURON_STAKE_E8S: u64 = 4_0000_0000;
const INITIAL_AIRDROP_CUTOFF: TimestampMillis = 1681516800000; // Saturday, 15 April 2023 00:00:00 UTC

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && runtime_state.data.initial_airdrop_open {
        let interval = INITIAL_AIRDROP_CUTOFF.saturating_sub(runtime_state.env.now());
        let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(interval), run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'finalize_initial_airdrop' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    ic_cdk::spawn(finalize_initial_airdrop());

    if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'finalize_initial_airdrop' job stopped");
    }
}

async fn finalize_initial_airdrop() {
    let PrepareResult {
        this_canister_id,
        governance_canister_id,
        ledger_canister_id,
    } = mutate_state(prepare);

    match stake_airdrop_source_neuron(this_canister_id, governance_canister_id, ledger_canister_id).await {
        Ok(result) => {
            mutate_state(|state| {
                finalize_initial_airdrop_impl(result.neuron_id, result.stake_e8s, state);
            });
        }
        Err(error) => error!(?error, "Failed to stake initial airdrop source neuron"),
    }
}

struct PrepareResult {
    this_canister_id: CanisterId,
    governance_canister_id: CanisterId,
    ledger_canister_id: CanisterId,
}

fn prepare(state: &mut RuntimeState) -> PrepareResult {
    assert!(state.data.initial_airdrop_open);
    assert!(state.data.initial_airdrop_neuron_id.is_none());

    state.data.initial_airdrop_open = false;

    PrepareResult {
        this_canister_id: state.env.canister_id(),
        governance_canister_id: state.data.openchat_governance_canister_id,
        ledger_canister_id: state.data.openchat_ledger_canister_id,
    }
}

fn finalize_initial_airdrop_impl(neuron_id: SnsNeuronId, stake_e8s: u64, state: &mut RuntimeState) {
    state.data.initial_airdrop_neuron_id = Some(neuron_id);

    let users: Vec<_> = state
        .data
        .neuron_controllers_for_initial_airdrop
        .keys()
        .filter_map(|u| state.data.users.get_by_user_id(u))
        .sorted_unstable_by_key(|u| u.date_created)
        .map(|u| u.user_id)
        .collect();

    assert!(!users.is_empty());

    let count = users.len() as u64;
    let fee_e8s = 100000u64;
    // Leave MIN_NEURON_STAKE_E8S in the source neuron
    let available_e8s = stake_e8s - MIN_NEURON_STAKE_E8S;

    let median = available_e8s / count;
    let max = median + (median / 2);
    let min = median / 2;
    let increment = median / (count - 1);
    let mut remaining_e8s = available_e8s;

    assert!(min > MIN_NEURON_STAKE_E8S + fee_e8s);

    for (index, user_id) in users.into_iter().enumerate() {
        let index = index as u64;
        let is_last = index == count - 1;
        let user_stake = if is_last { remaining_e8s } else { max - (index * increment) };
        remaining_e8s = remaining_e8s.checked_sub(user_stake).unwrap();

        state.data.initial_airdrop_queue.push(InitialAirdropEntry {
            user_id,
            neuron_controller: *state.data.neuron_controllers_for_initial_airdrop.get(&user_id).unwrap(),
            neuron_stake_e8s: user_stake,
        });
    }

    crate::jobs::distribute_airdrop_neurons::start_job_if_required(state);
}

async fn stake_airdrop_source_neuron(
    this_canister_id: CanisterId,
    governance_canister_id: CanisterId,
    ledger_canister_id: CanisterId,
) -> CallResult<StakeAirdropNeuronResult> {
    const MEMO: u64 = 0x504f5244; // == 'DROP'

    let ledger_client = ic_icrc1_client::ICRC1Client {
        ledger_canister_id,
        runtime: ic_icrc1_client_cdk::CdkRuntime,
    };
    let balance_e8s = ledger_client
        .balance_of(Account::from(PrincipalId::from(this_canister_id)))
        .await
        .map_err(|(code, msg)| (RejectionCode::from(code), msg))?;

    let fee_e8s = 100000;
    let stake_e8s = balance_e8s.saturating_sub(fee_e8s);
    let subaccount = compute_neuron_staking_subaccount_bytes(this_canister_id, MEMO);

    assert!(stake_e8s > 0);

    ledger_client
        .transfer(TransferArg {
            from_subaccount: None,
            to: Account {
                owner: governance_canister_id.into(),
                subaccount: Some(subaccount),
            },
            fee: Some(fee_e8s.into()),
            created_at_time: None,
            memo: Some(MEMO.into()),
            amount: stake_e8s.into(),
        })
        .await
        .map_err(|(code, msg)| (RejectionCode::from(code), msg))?
        .map_err(|e| (RejectionCode::Unknown, format!("TransferError: {e:?}")))?;

    let neuron_id = claim_neuron(this_canister_id, governance_canister_id, MEMO).await?;

    increase_dissolve_delay(governance_canister_id, neuron_id).await?;

    Ok(StakeAirdropNeuronResult { neuron_id, stake_e8s })
}

async fn claim_neuron(this_canister_id: CanisterId, governance_canister_id: CanisterId, memo: u64) -> CallResult<SnsNeuronId> {
    let args = ManageNeuron {
        subaccount: vec![],
        command: Some(Command::ClaimOrRefresh(ClaimOrRefresh {
            by: Some(By::MemoAndController(MemoAndController {
                controller: Some(this_canister_id.into()),
                memo,
            })),
        })),
    };

    let response = sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &args).await?;

    match response.command.unwrap() {
        CommandResponse::ClaimOrRefresh(c) => Ok(c.refreshed_neuron_id.unwrap().id.try_into().unwrap()),
        CommandResponse::Error(e) => Err((RejectionCode::Unknown, format!("{e:?}"))),
        _ => unreachable!(),
    }
}

async fn increase_dissolve_delay(governance_canister_id: CanisterId, neuron_id: SnsNeuronId) -> CallResult<()> {
    let args = ManageNeuron {
        subaccount: neuron_id.to_vec(),
        command: Some(Command::increase_dissolve_delay(31536000)), // 1 year
    };

    let response = sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &args).await?;

    match response.command.unwrap() {
        CommandResponse::Configure(_) => Ok(()),
        CommandResponse::Error(e) => Err((RejectionCode::Unknown, format!("{e:?}"))),
        _ => unreachable!(),
    }
}

fn compute_neuron_staking_subaccount_bytes(controller: Principal, nonce: u64) -> [u8; 32] {
    const DOMAIN: &[u8] = b"neuron-stake";
    const DOMAIN_LENGTH: [u8; 1] = [0x0c];

    let mut hasher = Sha256::new();
    hasher.update(DOMAIN_LENGTH);
    hasher.update(DOMAIN);
    hasher.update(controller.as_slice());
    hasher.update(nonce.to_be_bytes());
    hasher.finalize().into()
}

struct StakeAirdropNeuronResult {
    neuron_id: SnsNeuronId,
    stake_e8s: u64,
}
