use crate::governance_clients::common::{RawProposal, WrappedProposalId};
use crate::governance_clients::nns::ListProposalInfo;
use crate::governance_clients::sns::ListProposals;
use crate::model::nervous_systems::ProposalToPush;
use crate::{mutate_state, RuntimeState};
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::heartbeat;
use tracing::error;
use types::{CanisterId, ChatId, MessageContent, MessageId, Proposal, ProposalContent, ProposalId};

#[heartbeat]
fn heartbeat() {
    retrieve_proposals::run();
    push_proposals::run();
}

mod retrieve_proposals {
    use super::*;
    use crate::governance_clients;

    pub fn run() {
        if let Some((governance_canister_id, next_proposal_id, is_nns)) = mutate_state(get_next) {
            if is_nns {
                ic_cdk::spawn(retrieve_nns_proposal(governance_canister_id, next_proposal_id));
            } else {
                ic_cdk::spawn(retrieve_sns_proposal(governance_canister_id, next_proposal_id));
            }
        }
    }

    fn get_next(runtime_state: &mut RuntimeState) -> Option<(CanisterId, ProposalId, bool)> {
        let now = runtime_state.env.now();
        let (governance_canister_id, proposal_id) = runtime_state.data.nervous_systems.start_next_sync(now)?;
        let is_nns = governance_canister_id == runtime_state.data.nns_governance_canister_id;
        Some((governance_canister_id, proposal_id, is_nns))
    }

    async fn retrieve_nns_proposal(governance_canister_id: CanisterId, next_proposal_id: ProposalId) {
        let args = ListProposalInfo {
            limit: 1,
            before_proposal: Some(WrappedProposalId {
                id: next_proposal_id + 1,
            }),
            exclude_topic: Vec::new(),
            include_reward_status: Vec::new(),
            include_status: Vec::new(),
        };

        let response = governance_clients::nns::list_proposals(governance_canister_id, &args).await;
        handle_proposal_response(governance_canister_id, next_proposal_id, response);
    }

    async fn retrieve_sns_proposal(governance_canister_id: CanisterId, next_proposal_id: ProposalId) {
        let args = ListProposals {
            limit: 1,
            before_proposal: Some(WrappedProposalId {
                id: next_proposal_id + 1,
            }),
            exclude_type: Vec::new(),
            include_reward_status: Vec::new(),
            include_status: Vec::new(),
        };

        let response = governance_clients::sns::list_proposals(governance_canister_id, &args).await;
        handle_proposal_response(governance_canister_id, next_proposal_id, response);
    }

    fn handle_proposal_response<R: RawProposal>(
        governance_canister_id: CanisterId,
        next_proposal_id: u64,
        response: CallResult<Vec<R>>,
    ) {
        match response {
            Ok(response) => {
                mutate_state(|state| {
                    if let Some(raw_proposal) = response.into_iter().next() {
                        if raw_proposal.id() == next_proposal_id {
                            if !raw_proposal.is_excluded() {
                                match raw_proposal.try_into() {
                                    Ok(proposal) => {
                                        state
                                            .data
                                            .nervous_systems
                                            .enqueue_proposal(&governance_canister_id, proposal, false);
                                    }
                                    Err(error) => {
                                        error!(error, "Failed to transform proposal");
                                    }
                                }
                            }
                            state
                                .data
                                .nervous_systems
                                .set_next_proposal_id(&governance_canister_id, next_proposal_id + 1);
                        }
                    }

                    let now = state.env.now();
                    state
                        .data
                        .nervous_systems
                        .mark_sync_complete(&governance_canister_id, true, now);
                });
            }
            Err(_) => {
                mutate_state(|state| {
                    let now = state.env.now();
                    state
                        .data
                        .nervous_systems
                        .mark_sync_complete(&governance_canister_id, false, now);
                });
            }
        }
    }
}

mod push_proposals {
    use super::*;

    pub fn run() {
        if let Some(ProposalToPush {
            governance_canister_id,
            chat_id,
            proposal,
        }) = mutate_state(|state| state.data.nervous_systems.dequeue_next_proposal())
        {
            ic_cdk::spawn(push_proposal(governance_canister_id, chat_id, proposal));
        }
    }

    async fn push_proposal(governance_canister_id: CanisterId, chat_id: ChatId, proposal: Proposal) {
        let send_message_args = group_canister::send_message::Args {
            message_id: mutate_state(|state| MessageId::generate(|| state.env.random_u32())),
            thread_root_message_index: None,
            content: MessageContent::GovernanceProposal(ProposalContent {
                governance_canister_id,
                proposal_id: proposal.id,
                proposer: proposal.proposer,
                title: proposal.title.clone(),
                summary: proposal.summary.clone(),
                url: proposal.url.clone(),
                deadline: proposal.deadline,
                adopt_votes: 0,
                reject_votes: 0,
                my_vote: None,
            }),
            sender_name: "ProposalsBot".to_string(),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
        };
        match group_canister_c2c_client::send_message(chat_id.into(), &send_message_args).await {
            Ok(response) => {
                if !matches!(response, group_canister::send_message::Response::Success(_)) {
                    error!(?response, ?chat_id, proposal_id = proposal.id, "Error pushing proposal");
                }
                mutate_state(|state| {
                    state.data.nervous_systems.mark_proposal_completed(&governance_canister_id);
                });
            }
            _ => mutate_state(|state| {
                state.data.nervous_systems.mark_proposal_completed(&governance_canister_id);
                state
                    .data
                    .nervous_systems
                    .enqueue_proposal(&governance_canister_id, proposal, true);
            }),
        }
    }
}
