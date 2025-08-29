use crate::jobs::{push_proposals, update_proposals};
use crate::proposals::{REWARD_STATUS_ACCEPT_VOTES, REWARD_STATUS_READY_TO_SETTLE, RawProposal};
use crate::timer_job_types::{ProcessUserRefundJob, SubmitProposalJob, TimerJob, TopUpNeuronJob, VoteOnNnsProposalJob};
use crate::{RuntimeState, mutate_state};
use canister_timer_jobs::Job;
use constants::{MINUTE_IN_MS, SNS_GOVERNANCE_CANISTER_ID};
use nns_governance_canister::types::manage_neuron::{Command, RegisterVote};
use nns_governance_canister::types::{ListProposalInfo, ManageNeuron, ProposalInfo};
use proposals_bot_canister::{ExecuteGenericNervousSystemFunction, ProposalToSubmit, ProposalToSubmitAction};
use sns_governance_canister::types::ProposalData;
use std::collections::HashSet;
use std::time::Duration;
use types::{C2CError, CanisterId, NnsNeuronId, Proposal, ProposalId, SnsNeuronId};
use utils::canister::delay_if_should_retry_failed_c2c_call;

pub const NNS_TOPIC_NEURON_MANAGEMENT: i32 = 1;
pub const NNS_TOPIC_EXCHANGE_RATE: i32 = 2;

const BATCH_SIZE_LIMIT: u32 = 50;

const NNS_TOPIC_NETWORK_ECONOMICS: i32 = 3;
const NNS_TOPIC_GOVERNANCE: i32 = 4;
const NNS_TOPIC_SNS_AND_NEURON_FUND: i32 = 14;
const NNS_TOPICS_TO_PUSH_SNS_PROPOSALS_FOR: [i32; 3] = [
    NNS_TOPIC_NETWORK_ECONOMICS,
    NNS_TOPIC_GOVERNANCE,
    NNS_TOPIC_SNS_AND_NEURON_FUND,
];

pub fn start_job(state: &RuntimeState) {
    let interval = Duration::from_millis(if state.data.test_mode { 30 * MINUTE_IN_MS } else { MINUTE_IN_MS });
    ic_cdk_timers::set_timer_interval(interval, run);
}

pub fn run() {
    for (governance_canister_id, is_nns) in mutate_state(start_next_sync) {
        if is_nns {
            ic_cdk::futures::spawn(get_and_process_nns_proposals(governance_canister_id));
        } else {
            ic_cdk::futures::spawn(get_and_process_sns_proposals(governance_canister_id));
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

    handle_proposals_response(governance_canister_id, response);
}

async fn get_nns_proposals(governance_canister_id: CanisterId) -> Result<Vec<ProposalInfo>, C2CError> {
    let mut proposals: Vec<ProposalInfo> = Vec::new();

    loop {
        let list_proposals_args = ListProposalInfo {
            limit: BATCH_SIZE_LIMIT,
            before_proposal: proposals.iter().next_back().and_then(|p| p.id.clone()),
            exclude_topic: vec![NNS_TOPIC_NEURON_MANAGEMENT, NNS_TOPIC_EXCHANGE_RATE],
            include_reward_status: vec![REWARD_STATUS_ACCEPT_VOTES, REWARD_STATUS_READY_TO_SETTLE],
            ..Default::default()
        };

        let response = nns_governance_canister_c2c_client::list_proposals(governance_canister_id, &list_proposals_args)
            .await?
            .proposal_info;

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

    handle_proposals_response(governance_canister_id, response);
}

async fn get_sns_proposals(governance_canister_id: CanisterId) -> Result<Vec<ProposalData>, C2CError> {
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

fn handle_proposals_response<R: RawProposal>(governance_canister_id: CanisterId, response: Result<Vec<R>, C2CError>) {
    match response {
        Ok(raw_proposals) => {
            let mut proposals: Vec<Proposal> = raw_proposals.into_iter().filter_map(|p| p.try_into().ok()).collect();

            // TODO Remove this!
            // Temp hack for Dragginz
            // Dfinity are fixing a bug in their governance canister which is causing it to
            // return old proposals
            let dragginz_governance_canister_id: CanisterId = CanisterId::from_text("zqfso-syaaa-aaaaq-aaafq-cai").unwrap();
            if governance_canister_id == dragginz_governance_canister_id {
                proposals.retain(|p| p.id() > 36)
            }

            mutate_state(|state| {
                let now = state.env.now();

                if governance_canister_id == state.data.nns_governance_canister_id
                    && let Some(neuron_id) = state.data.nns_neuron_to_vote_with
                {
                    for proposal in proposals.iter() {
                        if let Proposal::NNS(nns) = proposal
                            && NNS_TOPICS_TO_PUSH_SNS_PROPOSALS_FOR.contains(&nns.topic)
                            && state.data.nns_proposals_requiring_manual_vote.insert(nns.id)
                        {
                            // Set up a job to reject the proposal 10 minutes before its deadline.
                            // In parallel, we will submit an SNS proposal instructing the SNS governance
                            // canister to adopt the proposal. So the resulting vote on the NNS proposal will
                            // depend on the outcome of the SNS proposal.
                            state.data.timer_jobs.enqueue_job(
                                TimerJob::VoteOnNnsProposal(VoteOnNnsProposalJob {
                                    nns_governance_canister_id: governance_canister_id,
                                    neuron_id,
                                    proposal_id: nns.id,
                                    vote: false,
                                }),
                                nns.deadline.saturating_sub(10 * MINUTE_IN_MS),
                                now,
                            );

                            if let Some(oc_neuron_id) = state
                                .data
                                .nervous_systems
                                .get_neuron_id_for_submitting_proposals(&SNS_GOVERNANCE_CANISTER_ID)
                            {
                                submit_oc_proposal_for_nns_proposal(nns.id, neuron_id, nns.title.clone(), oc_neuron_id);
                            }
                        }
                    }
                }

                let previous_active_proposals = state.data.nervous_systems.active_proposals(&governance_canister_id);
                let mut no_longer_active: HashSet<_> = previous_active_proposals.into_iter().collect();
                for id in proposals.iter().map(|p| p.id()) {
                    no_longer_active.remove(&id);
                }
                for id in no_longer_active.iter() {
                    state
                        .data
                        .finished_proposals_to_process
                        .push_back((governance_canister_id, *id));

                    crate::jobs::update_finished_proposals::start_job_if_required(state);
                }

                state.data.nervous_systems.process_proposals(
                    &governance_canister_id,
                    proposals,
                    no_longer_active.into_iter().collect(),
                );

                push_proposals::start_job_if_required(state);
                update_proposals::start_job_if_required(state);

                let decided_user_submitted_proposals = state
                    .data
                    .nervous_systems
                    .take_newly_decided_user_submitted_proposals(governance_canister_id);

                if let Some(ns) = state.data.nervous_systems.get(&governance_canister_id) {
                    let ledger_canister_id = ns.ledger_canister_id();
                    let amount = ns.proposal_rejection_fee().into();
                    let fee = ns.transaction_fee().into();
                    for proposal in decided_user_submitted_proposals {
                        if proposal.adopted {
                            let job = ProcessUserRefundJob {
                                user_id: proposal.user_id,
                                ledger_canister_id,
                                amount,
                                fee,
                            };
                            job.execute();
                        } else if let Some(neuron_id) = state
                            .data
                            .nervous_systems
                            .get_neuron_id_for_submitting_proposals(&governance_canister_id)
                        {
                            let job = TopUpNeuronJob {
                                governance_canister_id,
                                ledger_canister_id,
                                neuron_id,
                                amount,
                                fee,
                            };
                            job.execute();
                        }
                    }
                }

                state
                    .data
                    .nervous_systems
                    .mark_sync_complete(&governance_canister_id, true, now);
            });
        }
        Err(error) => {
            mutate_state(|state| {
                let now = state.env.now();
                state
                    .data
                    .nervous_systems
                    .mark_sync_complete(&governance_canister_id, false, now);

                if delay_if_should_retry_failed_c2c_call(error.reject_code(), error.message()).is_none() {
                    state.data.nervous_systems.mark_disabled(&governance_canister_id);
                }
            });
        }
    }
}

fn submit_oc_proposal_for_nns_proposal(
    nns_proposal_id: ProposalId,
    nns_neuron_id: NnsNeuronId,
    nns_proposal_title: String,
    oc_neuron_id: SnsNeuronId,
) {
    // If this proposal passes, the proposal will call `manage_neuron` on the NNS governance
    // canister instructing it to vote to approve the NNS proposal
    let manage_neuron_args = ManageNeuron {
        id: Some(nns_neuron_id.into()),
        neuron_id_or_subaccount: None,
        command: Some(Command::RegisterVote(RegisterVote {
            proposal: Some(nns_proposal_id.into()),
            vote: 1,
        })),
    };

    let payload = candid::encode_one(manage_neuron_args).unwrap();
    let nns_proposal_url = format!("https://dashboard.internetcomputer.org/proposal/{nns_proposal_id}");

    let job = SubmitProposalJob {
        governance_canister_id: SNS_GOVERNANCE_CANISTER_ID,
        neuron_id: oc_neuron_id,
        proposal: ProposalToSubmit {
            title: format!("Instruct the OpenChat NNS named neuron to approve NNS proposal {nns_proposal_id}"),
            summary: format!(
                "NNS proposal title: \"{nns_proposal_title}\"

The [OpenChat named neuron](https://dashboard.internetcomputer.org/neuron/17682165960669268263) will vote to either approve or reject [NNS proposal {nns_proposal_id}]({nns_proposal_url}) based on the outcome of this proposal."
            ),
            url: nns_proposal_url,
            action: ProposalToSubmitAction::ExecuteGenericNervousSystemFunction(ExecuteGenericNervousSystemFunction {
                function_id: 102000,
                payload,
            }),
        },
        user_id_and_payment: None,
    };

    job.execute();
}
