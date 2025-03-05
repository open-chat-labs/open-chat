use crate::jobs::update_proposals;
use crate::{mutate_state, RuntimeState};
use ic_cdk::call::RejectCode;
use ic_cdk_timers::TimerId;
use nns_governance_canister::types::ListProposalInfo;
use sns_governance_canister::types::ListProposals;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, Proposal, ProposalId};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.finished_proposals_to_process.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'update_finished_proposals' job started");
    TIMER_ID.set(None);

    mutate_state(run_impl);
}

fn run_impl(state: &mut RuntimeState) {
    if let Some((governance_canister_id, proposal_id)) = state.data.finished_proposals_to_process.pop_front() {
        if let Some(ns) = state.data.nervous_systems.get(&governance_canister_id) {
            if !ns.disabled() {
                let is_nns = governance_canister_id == state.data.nns_governance_canister_id;

                ic_cdk::futures::spawn(process_proposal(governance_canister_id, proposal_id, is_nns));
            }
        }
    }
    start_job_if_required(state);
}

async fn process_proposal(governance_canister_id: CanisterId, proposal_id: ProposalId, is_nns: bool) {
    let response = if is_nns {
        get_nns_proposal(governance_canister_id, proposal_id).await
    } else {
        get_sns_proposal(governance_canister_id, proposal_id).await
    };

    match response {
        Ok(Some(proposal)) => mutate_state(|state| {
            state
                .data
                .nervous_systems
                .process_finished_proposal(&governance_canister_id, proposal);

            update_proposals::start_job_if_required(state);
        }),
        Ok(None) => {}
        Err(_) => {
            mutate_state(|state| {
                state
                    .data
                    .finished_proposals_to_process
                    .push_back((governance_canister_id, proposal_id));

                start_job_if_required(state);
            });
        }
    }
}

async fn get_nns_proposal(
    governance_canister_id: CanisterId,
    proposal_id: ProposalId,
) -> Result<Option<Proposal>, (RejectCode, String)> {
    let response = nns_governance_canister_c2c_client::list_proposals(
        governance_canister_id,
        &ListProposalInfo {
            limit: 1,
            before_proposal: Some(nns_governance_canister::types::ProposalId { id: proposal_id + 1 }),
            ..Default::default()
        },
    )
    .await?
    .proposal_info;

    Ok(response.into_iter().next().and_then(|p| p.try_into().ok()))
}

async fn get_sns_proposal(
    governance_canister_id: CanisterId,
    proposal_id: ProposalId,
) -> Result<Option<Proposal>, (RejectCode, String)> {
    let response = sns_governance_canister_c2c_client::list_proposals(
        governance_canister_id,
        &ListProposals {
            limit: 1,
            before_proposal: Some(sns_governance_canister::types::ProposalId { id: proposal_id + 1 }),
            ..Default::default()
        },
    )
    .await?
    .proposals;

    Ok(response.into_iter().next().and_then(|p| p.try_into().ok()))
}
