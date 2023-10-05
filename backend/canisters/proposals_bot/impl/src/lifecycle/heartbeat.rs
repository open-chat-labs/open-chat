use crate::generate_message_id;
use crate::model::nervous_systems::{ProposalToPush, ProposalsToUpdate};
use crate::mutate_state;
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk_macros::heartbeat;
use types::{
    CanisterId, ChannelId, ChatId, CommunityId, MessageContentInitial, MessageId, MultiUserChat, Proposal, ProposalContent,
    ProposalUpdate,
};

#[heartbeat]
fn heartbeat() {
    push_proposals::run();
    update_proposals::run();
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
            match chat_id {
                MultiUserChat::Group(group_id) => {
                    ic_cdk::spawn(push_group_proposal(governance_canister_id, group_id, proposal));
                }
                MultiUserChat::Channel(community_id, channel_id) => {
                    ic_cdk::spawn(push_channel_proposal(
                        governance_canister_id,
                        community_id,
                        channel_id,
                        proposal,
                    ));
                }
            }
        }
    }

    async fn push_group_proposal(governance_canister_id: CanisterId, group_id: ChatId, proposal: Proposal) {
        let message_id = generate_message_id(governance_canister_id, proposal.id());
        let send_message_args = group_canister::send_message_v2::Args {
            message_id,
            thread_root_message_index: None,
            content: MessageContentInitial::GovernanceProposal(ProposalContent {
                governance_canister_id,
                proposal: proposal.clone(),
                my_vote: None,
            }),
            sender_name: "ProposalsBot".to_string(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            rules_accepted: None,
            correlation_id: 0,
        };

        let response = group_canister_c2c_client::send_message_v2(group_id.into(), &send_message_args).await;

        mark_proposal_pushed(governance_canister_id, proposal, message_id, is_failure(response));
    }

    async fn push_channel_proposal(
        governance_canister_id: CanisterId,
        community_id: CommunityId,
        channel_id: ChannelId,
        proposal: Proposal,
    ) {
        let message_id = generate_message_id(governance_canister_id, proposal.id());
        let send_message_args = community_canister::send_message::Args {
            message_id,
            thread_root_message_index: None,
            content: MessageContentInitial::GovernanceProposal(ProposalContent {
                governance_canister_id,
                proposal: proposal.clone(),
                my_vote: None,
            }),
            sender_name: "ProposalsBot".to_string(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            channel_id,
            community_rules_accepted: None,
            channel_rules_accepted: None,
        };

        let response = community_canister_c2c_client::send_message(community_id.into(), &send_message_args).await;

        mark_proposal_pushed(governance_canister_id, proposal, message_id, is_failure(response));
    }

    fn mark_proposal_pushed(governance_canister_id: CanisterId, proposal: Proposal, message_id: MessageId, failed: bool) {
        mutate_state(|state| {
            if failed {
                state
                    .data
                    .nervous_systems
                    .mark_proposal_push_failed(&governance_canister_id, proposal);
            } else {
                state
                    .data
                    .nervous_systems
                    .mark_proposal_pushed(&governance_canister_id, proposal, message_id);
            }
        });
    }

    fn is_failure<T>(response: CallResult<T>) -> bool {
        match response {
            // If the messageId has already been used, treat that as success
            Err((code, error)) if code == RejectionCode::CanisterError && error.contains("MessageId") => false,
            Err(_) => true,
            _ => false,
        }
    }
}

mod update_proposals {
    use super::*;

    pub fn run() {
        if let Some(ProposalsToUpdate {
            governance_canister_id,
            chat_id,
            proposals,
        }) = mutate_state(|state| state.data.nervous_systems.dequeue_next_proposals_to_update())
        {
            match chat_id {
                MultiUserChat::Group(group_id) => {
                    ic_cdk::spawn(update_group_proposals(governance_canister_id, group_id, proposals));
                }
                MultiUserChat::Channel(community_id, channel_id) => {
                    ic_cdk::spawn(update_channel_proposals(
                        governance_canister_id,
                        community_id,
                        channel_id,
                        proposals,
                    ));
                }
            }
        }
    }

    async fn update_group_proposals(governance_canister_id: CanisterId, group_id: ChatId, proposals: Vec<ProposalUpdate>) {
        let update_proposals_args = group_canister::c2c_update_proposals::Args {
            proposals: proposals.clone(),
            correlation_id: 0,
        };

        let failed = group_canister_c2c_client::c2c_update_proposals(group_id.into(), &update_proposals_args)
            .await
            .is_err();

        mark_proposals_updated(governance_canister_id, proposals, failed);
    }

    async fn update_channel_proposals(
        governance_canister_id: CanisterId,
        community_id: CommunityId,
        channel_id: ChannelId,
        proposals: Vec<ProposalUpdate>,
    ) {
        let update_proposals_args = community_canister::c2c_update_proposals::Args {
            channel_id,
            proposals: proposals.clone(),
        };

        let failed = community_canister_c2c_client::c2c_update_proposals(community_id.into(), &update_proposals_args)
            .await
            .is_err();

        mark_proposals_updated(governance_canister_id, proposals, failed);
    }

    fn mark_proposals_updated(governance_canister_id: CanisterId, proposals: Vec<ProposalUpdate>, failed: bool) {
        mutate_state(|state| {
            let now = state.env.now();
            if failed {
                state
                    .data
                    .nervous_systems
                    .mark_proposals_update_failed(&governance_canister_id, proposals, now);
            } else {
                state
                    .data
                    .nervous_systems
                    .mark_proposals_updated(&governance_canister_id, now);
            }
        });
    }
}
