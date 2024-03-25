use crate::model::nervous_systems::ProposalToPush;
use crate::{generate_message_id, mutate_state, read_state, RuntimeState};
use chat_events::{MessageContentInternal, ProposalContentInternal};
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::collections::HashMap;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, ChannelId, ChatId, CommunityId, MessageId, MultiUserChat, Proposal};

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

    mark_proposal_pushed(governance_canister_id, proposal, message_id, is_failure(response));
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
        start_job_if_required(state);
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
