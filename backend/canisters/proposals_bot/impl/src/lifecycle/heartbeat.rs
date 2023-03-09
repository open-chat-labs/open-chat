use crate::governance_clients;
use crate::governance_clients::common::RawProposal;
use crate::governance_clients::nns::governance_response_types::ProposalInfo;
use crate::governance_clients::nns::{
    ListProposalInfo, REWARD_STATUS_ACCEPT_VOTES, REWARD_STATUS_READ_TO_SETTLE, TOPIC_EXCHANGE_RATE, TOPIC_NEURON_MANAGEMENT,
};
use crate::governance_clients::sns::governance_response_types::ProposalData;
use crate::governance_clients::sns::ListProposals;
use crate::model::nervous_systems::{ProposalToPush, ProposalsToUpdate};
use crate::{mutate_state, RuntimeState};
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::heartbeat;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use types::{CanisterId, ChatId, MessageContent, MessageId, Proposal, ProposalContent, ProposalId};

#[heartbeat]
fn heartbeat() {
    retrieve_proposals::run();
    push_proposals::run();
    update_proposals::run();
}

mod retrieve_proposals {
    use super::*;

    const BATCH_SIZE_LIMIT: u32 = 50;

    pub fn run() {
        if let Some((governance_canister_id, is_nns)) = mutate_state(get_next) {
            if is_nns {
                ic_cdk::spawn(get_and_process_nns_proposals(governance_canister_id));
            } else {
                ic_cdk::spawn(get_and_process_sns_proposals(governance_canister_id));
            }
        }
    }

    fn get_next(runtime_state: &mut RuntimeState) -> Option<(CanisterId, bool)> {
        let now = runtime_state.env.now();
        let governance_canister_id = runtime_state.data.nervous_systems.start_next_sync(now)?;
        let is_nns = governance_canister_id == runtime_state.data.nns_governance_canister_id;
        Some((governance_canister_id, is_nns))
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
                before_proposal: proposals.iter().rev().next().and_then(|p| p.id.clone()),
                exclude_topic: vec![TOPIC_NEURON_MANAGEMENT, TOPIC_EXCHANGE_RATE],
                include_reward_status: vec![REWARD_STATUS_ACCEPT_VOTES, REWARD_STATUS_READ_TO_SETTLE],
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
            let list_proposals_args = ListProposals {
                limit: BATCH_SIZE_LIMIT,
                before_proposal: proposals.iter().rev().next().and_then(|p| p.id.clone()),
                ..Default::default()
            };

            let response = governance_clients::sns::list_proposals(governance_canister_id, &list_proposals_args).await?;
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
}

mod push_proposals {
    use super::*;

    pub fn run() {
        if let Some(ProposalToPush {
            governance_canister_id,
            chat_id,
            proposal,
        }) = mutate_state(|state| state.data.nervous_systems.dequeue_next_proposal_to_push())
        {
            ic_cdk::spawn(push_proposal(governance_canister_id, chat_id, proposal));
        }
    }

    async fn push_proposal(governance_canister_id: CanisterId, chat_id: ChatId, proposal: Proposal) {
        let message_id = generate_message_id(governance_canister_id, proposal.id());
        let send_message_args = group_canister::send_message::Args {
            message_id,
            thread_root_message_index: None,
            content: MessageContent::GovernanceProposal(ProposalContent {
                governance_canister_id,
                proposal: proposal.clone(),
                my_vote: None,
            }),
            sender_name: "ProposalsBot".to_string(),
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            correlation_id: 0,
        };
        match group_canister_c2c_client::send_message(chat_id.into(), &send_message_args).await {
            Ok(_) => {
                mutate_state(|state| {
                    state
                        .data
                        .nervous_systems
                        .mark_proposal_pushed(&governance_canister_id, proposal, message_id);
                });
            }
            // TODO remove this after the next upgrade
            Err((_, msg)) if msg.contains("MessageId already used") => {
                mutate_state(|state| {
                    state
                        .data
                        .nervous_systems
                        .mark_proposal_pushed(&governance_canister_id, proposal, message_id);
                });
            }
            _ => mutate_state(|state| {
                state
                    .data
                    .nervous_systems
                    .mark_proposal_push_failed(&governance_canister_id, proposal);
            }),
        }
    }

    // Deterministically generate each MessageId so that there is never any chance of a proposal
    // being sent twice
    fn generate_message_id(governance_canister_id: CanisterId, proposal_id: ProposalId) -> MessageId {
        let mut hash = Sha256::new();
        hash.update(b"proposals_bot");
        hash.update(governance_canister_id.as_slice());
        hash.update(proposal_id.to_ne_bytes());
        let array32: [u8; 32] = hash.finalize().try_into().unwrap();
        let array16: [u8; 16] = array32[..16].try_into().unwrap();
        u128::from_ne_bytes(array16).into()
    }
}

mod update_proposals {
    use super::*;
    use group_canister::c2c_update_proposals::ProposalUpdate;

    pub fn run() {
        if let Some(ProposalsToUpdate {
            governance_canister_id,
            chat_id,
            proposals,
        }) = mutate_state(|state| state.data.nervous_systems.dequeue_next_proposals_to_update())
        {
            ic_cdk::spawn(update_proposals(governance_canister_id, chat_id, proposals));
        }
    }

    async fn update_proposals(governance_canister_id: CanisterId, chat_id: ChatId, proposals: Vec<ProposalUpdate>) {
        let update_proposals_args = group_canister::c2c_update_proposals::Args {
            proposals: proposals.clone(),
            correlation_id: 0,
        };
        match group_canister_c2c_client::c2c_update_proposals(chat_id.into(), &update_proposals_args).await {
            Ok(_) => {
                mutate_state(|state| {
                    let now = state.env.now();
                    state
                        .data
                        .nervous_systems
                        .mark_proposals_updated(&governance_canister_id, now);
                });
            }
            _ => mutate_state(|state| {
                let now = state.env.now();
                state
                    .data
                    .nervous_systems
                    .mark_proposals_update_failed(&governance_canister_id, proposals, now);
            }),
        }
    }
}
