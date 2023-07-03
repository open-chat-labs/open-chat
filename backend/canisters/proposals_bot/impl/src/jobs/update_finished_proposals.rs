use crate::governance_clients::common::WrappedProposalId;
use crate::governance_clients::nns::ListProposalInfo;
use crate::governance_clients::sns::ListProposals;
use crate::{generate_message_id, governance_clients, mutate_state, RuntimeState};
use ic_cdk::api::call::CallResult;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, ProposalDecisionStatus, ProposalId, ProposalRewardStatus, ProposalUpdate, TimestampMillis};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.finished_proposals_to_process.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'update_finished_proposals' job started");
        true
    } else {
        false
    }
}

fn run() {
    mutate_state(run_impl);
}

fn run_impl(state: &mut RuntimeState) {
    if let Some((governance_canister_id, proposal_id)) = state.data.finished_proposals_to_process.pop_front() {
        if state.data.nervous_systems.exists(&governance_canister_id) {
            let is_nns = governance_canister_id == state.data.nns_governance_canister_id;
            let now = state.env.now();

            ic_cdk::spawn(process_proposal(governance_canister_id, proposal_id, is_nns, now));
        }
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'update_finished_proposals' job stopped");
    }
}

async fn process_proposal(governance_canister_id: CanisterId, proposal_id: ProposalId, is_nns: bool, now: TimestampMillis) {
    let response = if is_nns {
        get_nns_proposal(governance_canister_id, proposal_id).await
    } else {
        get_sns_proposal(governance_canister_id, proposal_id, now).await
    };

    match response {
        Ok(Some(proposal)) => mutate_state(|state| {
            state
                .data
                .nervous_systems
                .queue_proposal_to_update(governance_canister_id, proposal)
        }),
        Ok(None) => {}
        Err(_) => {
            mutate_state(|state| {
                state
                    .data
                    .finished_proposals_to_process
                    .push_back((governance_canister_id, proposal_id))
            });
        }
    }
}

async fn get_nns_proposal(governance_canister_id: CanisterId, proposal_id: ProposalId) -> CallResult<Option<ProposalUpdate>> {
    let response = governance_clients::nns::list_proposals(
        governance_canister_id,
        &ListProposalInfo {
            limit: 1,
            before_proposal: Some(WrappedProposalId { id: proposal_id + 1 }),
            ..Default::default()
        },
    )
    .await?;

    Ok(response.into_iter().next().map(|p| ProposalUpdate {
        message_id: generate_message_id(governance_canister_id, proposal_id),
        status: ProposalDecisionStatus::try_from(p.status).ok(),
        reward_status: ProposalRewardStatus::try_from(p.reward_status).ok(),
        latest_tally: p.latest_tally.map(|t| t.into()),
        deadline: None,
    }))
}

async fn get_sns_proposal(
    governance_canister_id: CanisterId,
    proposal_id: ProposalId,
    now: TimestampMillis,
) -> CallResult<Option<ProposalUpdate>> {
    let response = governance_clients::sns::list_proposals(
        governance_canister_id,
        &ListProposals {
            limit: 1,
            before_proposal: Some(WrappedProposalId { id: proposal_id + 1 }),
            ..Default::default()
        },
    )
    .await?;

    Ok(response.into_iter().next().map(|p| ProposalUpdate {
        message_id: generate_message_id(governance_canister_id, proposal_id),
        status: Some(p.status()),
        reward_status: Some(p.reward_status(now)),
        latest_tally: p.latest_tally.map(|t| t.into()),
        deadline: None,
    }))
}
