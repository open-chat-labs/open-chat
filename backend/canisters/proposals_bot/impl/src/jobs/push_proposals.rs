use crate::model::nervous_systems::ProposalToPush;
use crate::{generate_message_id, mutate_state, read_state, RuntimeState};
use chat_events::{MessageContentInternal, ProposalContentInternal};
use ic_cdk::call::RejectCode;
use ic_cdk_timers::TimerId;
use sns_governance_canister::types::{get_proposal_response, ProposalId};
use std::cell::Cell;
use std::collections::HashMap;
use std::fmt::Debug;
use std::time::Duration;
use tracing::{error, trace};
use types::{CanisterId, ChannelId, ChatId, CommunityId, MessageId, MessageIndex, MultiUserChat, Proposal};

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
        ic_cdk::futures::spawn(push_proposal(proposal));
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
    if let Ok(proposal) = fetch_payload_rendering_if_required(governance_canister_id, proposal).await {
        match chat_id {
            MultiUserChat::Group(group_id) => {
                push_group_proposal(governance_canister_id, group_id, proposal).await;
            }
            MultiUserChat::Channel(community_id, channel_id) => {
                push_channel_proposal(governance_canister_id, community_id, channel_id, proposal).await;
            }
        }
    }
}

async fn fetch_payload_rendering_if_required(
    governance_canister_id: CanisterId,
    proposal: Proposal,
) -> Result<Proposal, (RejectCode, String)> {
    if let Proposal::SNS(p) = &proposal {
        // If not a motion proposal, call `get_proposal` to get the payload rendering.
        if p.action != 1 {
            match sns_governance_canister_c2c_client::get_proposal(
                governance_canister_id,
                &sns_governance_canister::get_proposal::Args {
                    proposal_id: Some(ProposalId { id: proposal.id() }),
                },
            )
            .await
            {
                Ok(response) => {
                    if let Some(get_proposal_response::Result::Proposal(p)) = response.result {
                        return Ok(p.try_into().unwrap());
                    }
                }
                Err(error) => {
                    mark_proposal_pushed(governance_canister_id, proposal, Err(error.0));
                    return Err(error);
                }
            }
        }
    }
    Ok(proposal)
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
        block_level_markdown: true,
        rules_accepted: None,
        message_filter_failed: None,
        correlation_id: 0,
    };

    let canister_id = group_id.into();
    let response = group_canister_c2c_client::c2c_send_message(canister_id, &send_message_args).await;

    mark_proposal_pushed(
        governance_canister_id,
        proposal,
        extract_group_result(message_id, response, canister_id),
    );
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
        block_level_markdown: true,
        channel_id,
        community_rules_accepted: None,
        channel_rules_accepted: None,
        message_filter_failed: None,
    };

    let canister_id = community_id.into();
    let response = community_canister_c2c_client::c2c_send_message(canister_id, &send_message_args).await;

    mark_proposal_pushed(
        governance_canister_id,
        proposal,
        extract_channel_result(message_id, response, canister_id),
    );
}

fn mark_proposal_pushed(
    governance_canister_id: CanisterId,
    proposal: Proposal,
    result: Result<(MessageId, Option<MessageIndex>), RejectCode>,
) {
    mutate_state(|state| {
        match result {
            Ok((message_id, message_index)) => {
                state
                    .data
                    .nervous_systems
                    .mark_proposal_pushed(&governance_canister_id, proposal, message_id, message_index);
            }
            Err(code) => {
                state
                    .data
                    .nervous_systems
                    .mark_proposal_push_failed(&governance_canister_id, proposal);

                if code == RejectCode::DestinationInvalid {
                    state.data.nervous_systems.mark_disabled(&governance_canister_id);
                }
            }
        }
        start_job_if_required(state);
    });
}

fn extract_channel_result(
    message_id: MessageId,
    response: Result<community_canister::c2c_send_message::Response, (RejectCode, String)>,
    canister_id: CanisterId,
) -> Result<(MessageId, Option<MessageIndex>), RejectCode> {
    match response {
        Ok(community_canister::c2c_send_message::Response::Success(result)) => Ok((message_id, Some(result.message_index))),
        other => extract_result_inner(message_id, other, canister_id),
    }
}

fn extract_group_result(
    message_id: MessageId,
    response: Result<group_canister::c2c_send_message::Response, (RejectCode, String)>,
    canister_id: CanisterId,
) -> Result<(MessageId, Option<MessageIndex>), RejectCode> {
    match response {
        Ok(group_canister::c2c_send_message::Response::Success(result)) => Ok((message_id, Some(result.message_index))),
        other => extract_result_inner(message_id, other, canister_id),
    }
}

fn extract_result_inner<T: Debug>(
    message_id: MessageId,
    response: Result<T, (RejectCode, String)>,
    canister_id: CanisterId,
) -> Result<(MessageId, Option<MessageIndex>), RejectCode> {
    match response {
        // If the messageId has already been used, treat that as success
        Err((code, error)) if code == RejectCode::CanisterError && error.contains("MessageId") => Ok((message_id, None)),
        Err((code, _)) => Err(code),
        _ => {
            error!(?response, %canister_id, "Failed to push proposal");
            Err(RejectCode::CanisterError)
        }
    }
}
