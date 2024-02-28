use crate::model::nervous_systems::ProposalToPush;
use crate::timer_job_types::{SubmitOCProposalForNnsProposalJob, TimerJob};
use crate::{generate_message_id, mutate_state, read_state, RuntimeState};
use chat_events::{MessageContentInternal, ProposalContentInternal};
use ic_cdk::api::call::RejectionCode;
use ic_cdk_timers::TimerId;
use proposals_bot_canister::{ProposalToSubmit, ProposalToSubmitAction};
use std::cell::Cell;
use std::collections::HashMap;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, ChannelId, ChatId, CommunityId, MessageId, MessageIndex, MultiUserChat, Proposal, SnsNeuronId};
use utils::consts::SNS_GOVERNANCE_CANISTER_ID;

const NNS_TOPIC_NETWORK_ECONOMICS: i32 = 3;
const NNS_TOPIC_GOVERNANCE: i32 = 4;
const NNS_TOPIC_SNS_AND_NEURON_FUND: i32 = 14;
const NNS_TOPICS_TO_PUSH_SNS_PROPOSALS_FOR: [i32; 3] = [
    NNS_TOPIC_NETWORK_ECONOMICS,
    NNS_TOPIC_GOVERNANCE,
    NNS_TOPIC_SNS_AND_NEURON_FUND,
];

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.nervous_systems.any_proposals_to_push() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    trace!("'push_proposals' job started");
    TIMER_ID.set(None);

    if let Some(proposal) = mutate_state(|state| state.data.nervous_systems.dequeue_next_proposal_to_push()) {
        ic_cdk::spawn(push_proposal(proposal));
    }
    read_state(start_job_if_required);
}

async fn push_proposal(
    ProposalToPush {
        governance_canister_id,
        chat_id,
        proposal,
    }: ProposalToPush,
) {
    match chat_id {
        MultiUserChat::Group(group_id) => {
            push_group_proposal(governance_canister_id, group_id, proposal).await;
        }
        MultiUserChat::Channel(community_id, channel_id) => {
            push_channel_proposal(governance_canister_id, community_id, channel_id, proposal).await;
        }
    }
}

async fn push_group_proposal(governance_canister_id: CanisterId, group_id: ChatId, proposal: Proposal) {
    let message_id = generate_message_id(governance_canister_id, proposal.id());
    let send_message_args = group_canister::c2c_send_message::Args {
        message_id,
        thread_root_message_index: None,
        content: MessageContentInternal::GovernanceProposal(ProposalContentInternal {
            governance_canister_id,
            proposal: proposal.clone(),
            votes: HashMap::new(),
        }),
        sender_name: "ProposalsBot".to_string(),
        sender_display_name: None,
        replies_to: None,
        mentioned: Vec::new(),
        forwarding: false,
        rules_accepted: None,
        message_filter_failed: None,
        correlation_id: 0,
    };

    let response = group_canister_c2c_client::c2c_send_message(group_id.into(), &send_message_args).await;

    let result = match response {
        Ok(group_canister::c2c_send_message::Response::Success(r)) => PushProposalResult::Success(r.message_index),
        Err(error) => error.into(),
        _ => PushProposalResult::Error,
    };

    mark_proposal_pushed(governance_canister_id, proposal, message_id, result);
}

async fn push_channel_proposal(
    governance_canister_id: CanisterId,
    community_id: CommunityId,
    channel_id: ChannelId,
    proposal: Proposal,
) {
    let message_id = generate_message_id(governance_canister_id, proposal.id());
    let send_message_args = community_canister::c2c_send_message::Args {
        message_id,
        thread_root_message_index: None,
        content: MessageContentInternal::GovernanceProposal(ProposalContentInternal {
            governance_canister_id,
            proposal: proposal.clone(),
            votes: HashMap::new(),
        }),
        sender_name: "ProposalsBot".to_string(),
        sender_display_name: None,
        replies_to: None,
        mentioned: Vec::new(),
        forwarding: false,
        channel_id,
        community_rules_accepted: None,
        channel_rules_accepted: None,
        message_filter_failed: None,
    };

    let response = community_canister_c2c_client::c2c_send_message(community_id.into(), &send_message_args).await;

    let result = match response {
        Ok(community_canister::c2c_send_message::Response::Success(r)) => PushProposalResult::Success(r.message_index),
        Err(error) => error.into(),
        _ => PushProposalResult::Error,
    };

    mark_proposal_pushed(governance_canister_id, proposal, message_id, result);
}

fn mark_proposal_pushed(
    governance_canister_id: CanisterId,
    proposal: Proposal,
    message_id: MessageId,
    result: PushProposalResult,
) {
    mutate_state(|state| {
        match result {
            PushProposalResult::Success(message_index) => {
                if let Proposal::NNS(nns) = &proposal {
                    if !state.data.test_mode && NNS_TOPICS_TO_PUSH_SNS_PROPOSALS_FOR.contains(&nns.topic) {
                        if let Some((proposal, oc_neuron_id)) =
                            build_oc_proposal_for_nns_proposal(nns.id, nns.title.clone(), message_index, state)
                        {
                            let now = state.env.now();
                            state.data.timer_jobs.enqueue_job(
                                TimerJob::SubmitOCProposalForNnsProposal(SubmitOCProposalForNnsProposalJob {
                                    nns_proposal_id: nns.id,
                                    nns_proposal_deadline: nns.deadline,
                                    oc_neuron_id,
                                    proposal,
                                }),
                                now,
                                now,
                            );
                        }
                    }
                }

                state
                    .data
                    .nervous_systems
                    .mark_proposal_pushed(&governance_canister_id, proposal, message_id);
            }
            PushProposalResult::Error => {
                state
                    .data
                    .nervous_systems
                    .mark_proposal_push_failed(&governance_canister_id, proposal);
            }
            PushProposalResult::Duplicate => return,
        }
        start_job_if_required(state);
    });
}

fn build_oc_proposal_for_nns_proposal(
    nns_proposal_id: u64,
    nns_proposal_title: String,
    message_index: MessageIndex,
    state: &RuntimeState,
) -> Option<(ProposalToSubmit, SnsNeuronId)> {
    let chat = state
        .data
        .nervous_systems
        .get_chat_id(&state.data.nns_governance_canister_id)?;

    let oc_neuron_id = state
        .data
        .nervous_systems
        .get_neuron_id_for_submitting_proposals(&SNS_GOVERNANCE_CANISTER_ID)?;

    let nns_proposal_message_url = chat.message_url(message_index);

    let proposal = ProposalToSubmit {
        title: format!("Instruct the OpenChat controlled NNS neuron to approve NNS proposal {nns_proposal_id}"),
        summary: format!("The OpenChat SNS controls NNS neuron [17682165960669268263](https://dashboard.internetcomputer.org/neuron/17682165960669268263).

This neuron is set up to follow Dfinity on all topics except Network Economics, Governance and SNS & Neuron's Fund. For these 3 topics the neuron must vote manually.

To decide how the NNS neuron should vote, a corresponding SNS proposal will be submitted for each relevant NNS proposal, if the SNS proposal passes, the neuron will vote to approve the NNS proposal, otherwise the neuron will vote to reject the NNS proposal.

This proposal is to decide if the OpenChat controlled NNS neuron should vote to approve NNS proposal - '[{nns_proposal_title}]({nns_proposal_message_url})'."),
        url: chat.message_url(message_index),
        action: ProposalToSubmitAction::Motion,
    };

    Some((proposal, oc_neuron_id))
}

enum PushProposalResult {
    Success(MessageIndex),
    Duplicate,
    Error,
}

impl From<(RejectionCode, String)> for PushProposalResult {
    fn from((code, error): (RejectionCode, String)) -> Self {
        if code == RejectionCode::CanisterError && error.contains("MessageId") {
            PushProposalResult::Duplicate
        } else {
            PushProposalResult::Error
        }
    }
}
