use crate::nns_governance_client::governance_response_types::{ListProposalInfoResponse, ProposalInfo};
use candid::CandidType;
use ic_cdk::api::call::CallResult;
use serde::Deserialize;
use tracing::error;
use types::{CanisterId, NeuronId, Proposal, ProposalId};

pub async fn list_proposals(governance_canister_id: CanisterId, args: ListProposalInfo) -> CallResult<Vec<ProposalResult>> {
    let method_name = "list_proposals";
    let response: CallResult<(ListProposalInfoResponse,)> =
        ic_cdk::api::call::call(governance_canister_id, method_name, (&args,)).await;

    if let Err(error) = &response {
        error!(method_name, error_code = ?error.0, error_message = error.1.as_str(), "Error calling c2c");
    }

    response.map(|r| {
        r.0.proposal_info
            .into_iter()
            .map(|p| ProposalResult {
                proposal_id: p.id.as_ref().unwrap().id,
                proposal: map_proposal(p).map_err(|s| s.to_string()),
            })
            .collect()
    })
}

fn map_proposal(p: ProposalInfo) -> Result<Proposal, &'static str> {
    let proposal = p.proposal.ok_or("proposal not set")?;

    Ok(Proposal {
        id: p.id.ok_or("id not set")?.id,
        topic: p.topic,
        proposer: p.proposer.ok_or("proposer not set")?.id,
        title: proposal.title.ok_or("title not set")?,
        summary: proposal.summary,
        url: proposal.url,
        deadline: p.deadline_timestamp_seconds.ok_or("deadline_timestamp_seconds not set")? * 1000,
    })
}

#[derive(CandidType, Deserialize)]
pub struct ListProposalInfo {
    pub limit: u32,
    pub before_proposal: Option<WrappedProposalId>,
    pub exclude_topic: Vec<i32>,
    pub include_reward_status: Vec<i32>,
    pub include_status: Vec<i32>,
}

pub struct ProposalResult {
    pub proposal_id: ProposalId,
    pub proposal: Result<Proposal, String>,
}

#[derive(CandidType, Deserialize)]
pub struct WrappedProposalId {
    pub id: ProposalId,
}

pub mod governance_response_types {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct ListProposalInfoResponse {
        pub proposal_info: Vec<ProposalInfo>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct ProposalInfo {
        pub id: Option<WrappedProposalId>,
        pub topic: i32,
        pub proposer: Option<WrappedNeuronId>,
        pub proposal: Option<Proposal>,
        pub proposal_timestamp_seconds: u64,
        pub deadline_timestamp_seconds: Option<u64>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct Proposal {
        pub title: Option<String>,
        pub summary: String,
        pub url: String,
    }

    #[derive(CandidType, Deserialize)]
    pub struct WrappedNeuronId {
        pub id: NeuronId,
    }
}
