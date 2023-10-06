use crate::governance_clients::common::{RawProposal, REWARD_STATUS_ACCEPT_VOTES, REWARD_STATUS_READY_TO_SETTLE};
use crate::governance_clients::nns::governance_response_types::ProposalInfo;
use crate::governance_clients::nns::{ListProposalInfo, TOPIC_EXCHANGE_RATE, TOPIC_NEURON_MANAGEMENT};
use crate::{governance_clients, mutate_state, RuntimeState};
use ic_cdk::api::call::CallResult;
use sns_governance_canister::types::ProposalData;
use std::collections::HashSet;
use std::time::Duration;
use types::{CanisterId, Milliseconds, Proposal};
use utils::time::MINUTE_IN_MS;

const BATCH_SIZE_LIMIT: u32 = 50;
const RETRIEVE_PROPOSALS_INTERVAL: Milliseconds = MINUTE_IN_MS;

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(Duration::from_millis(RETRIEVE_PROPOSALS_INTERVAL), run);
}

pub fn run() {
    for (governance_canister_id, is_nns) in mutate_state(start_next_sync) {
        if is_nns {
            ic_cdk::spawn(get_and_process_nns_proposals(governance_canister_id));
        } else {
            ic_cdk::spawn(get_and_process_sns_proposals(governance_canister_id));
        }
    }
}

// Returns Vec<(governance_canister_id, is_nns)>
fn start_next_sync(state: &mut RuntimeState) -> Vec<(CanisterId, bool)> {
    let governance_canister_ids = state.data.nervous_systems.start_next_sync();
    governance_canister_ids
        .into_iter()
        .map(|id| (id, id == state.data.nns_governance_canister_id))
        .collect()
}

async fn get_and_process_nns_proposals(governance_canister_id: CanisterId) {
    let response = get_nns_proposals(governance_canister_id).await;

    handle_proposals_response(&governance_canister_id, response);
}

async fn get_nns_proposals(governance_canister_id: CanisterId) -> CallResult<Vec<ProposalInfo>> {
    let mut proposals: Vec<ProposalInfo> = Vec::new();

    loop {
        let list_proposals_args = ListProposalInfo {
            limit: BATCH_SIZE_LIMIT,
            before_proposal: proposals.iter().next_back().and_then(|p| p.id.clone()),
            exclude_topic: vec![TOPIC_NEURON_MANAGEMENT, TOPIC_EXCHANGE_RATE],
            include_reward_status: vec![REWARD_STATUS_ACCEPT_VOTES, REWARD_STATUS_READY_TO_SETTLE],
            ..Default::default()
        };

        let response = governance_clients::nns::list_proposals(governance_canister_id, &list_proposals_args).await?;
        let finished = response.len() < BATCH_SIZE_LIMIT as usize;
        proposals.extend(response);

        if finished {
            break;
        }
    }

    Ok(proposals)
}

async fn get_and_process_sns_proposals(governance_canister_id: CanisterId) {
    let response = get_sns_proposals(governance_canister_id).await;

    handle_proposals_response(&governance_canister_id, response);
}

async fn get_sns_proposals(governance_canister_id: CanisterId) -> CallResult<Vec<ProposalData>> {
    let mut proposals: Vec<ProposalData> = Vec::new();

    loop {
        let list_proposals_args = sns_governance_canister::list_proposals::Args {
            limit: BATCH_SIZE_LIMIT,
            before_proposal: proposals.iter().next_back().and_then(|p| p.id),
            include_reward_status: vec![REWARD_STATUS_ACCEPT_VOTES, REWARD_STATUS_READY_TO_SETTLE],
            ..Default::default()
        };

        let response = sns_governance_canister_c2c_client::list_proposals(governance_canister_id, &list_proposals_args)
            .await?
            .proposals;

        let finished = response.len() < BATCH_SIZE_LIMIT as usize;
        proposals.extend(response);

        if finished {
            break;
        }
    }

    Ok(proposals)
}

fn handle_proposals_response<R: RawProposal>(governance_canister_id: &CanisterId, response: CallResult<Vec<R>>) {
    match response {
        Ok(raw_proposals) => {
            let proposals: Vec<Proposal> = raw_proposals.into_iter().filter_map(|p| p.try_into().ok()).collect();

            mutate_state(|state| {
                let previous_active_proposals = state.data.nervous_systems.active_proposals(governance_canister_id);
                let mut no_longer_active: HashSet<_> = previous_active_proposals.into_iter().collect();
                for id in proposals.iter().map(|p| p.id()) {
                    no_longer_active.remove(&id);
                }
                for id in no_longer_active.iter() {
                    state
                        .data
                        .finished_proposals_to_process
                        .push_back((*governance_canister_id, *id));

                    crate::jobs::update_finished_proposals::start_job_if_required(state);
                }

                state.data.nervous_systems.process_proposals(
                    governance_canister_id,
                    proposals,
                    no_longer_active.into_iter().collect(),
                );

                let now = state.env.now();
                state
                    .data
                    .nervous_systems
                    .mark_sync_complete(governance_canister_id, true, now);
            });
        }
        Err(_) => {
            mutate_state(|state| {
                let now = state.env.now();
                state
                    .data
                    .nervous_systems
                    .mark_sync_complete(governance_canister_id, false, now);
            });
        }
    }
}
