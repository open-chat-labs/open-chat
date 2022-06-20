use self::governance_response_types::{ListProposalInfoResponse, ProposalInfo};
use super::common::{RawProposal, WrappedNeuronId, WrappedProposalId};
use candid::CandidType;
use ic_cdk::api::call::CallResult;
use serde::Deserialize;
use tracing::error;
use types::{CanisterId, ProposalId};

pub async fn list_proposals(governance_canister_id: CanisterId, args: &ListProposalInfo) -> CallResult<Vec<ProposalInfo>> {
    let method_name = "list_proposals";
    let response: CallResult<(ListProposalInfoResponse,)> =
        ic_cdk::api::call::call(governance_canister_id, method_name, (args,)).await;

    if let Err(error) = &response {
        error!(method_name, error_code = ?error.0, error_message = error.1.as_str(), "Error calling c2c");
    }

    response.map(|r| r.0.proposal_info)
}

#[derive(CandidType, Deserialize)]
pub struct ListProposalInfo {
    pub limit: u32,
    pub before_proposal: Option<WrappedProposalId>,
    pub exclude_topic: Vec<i32>,
    pub include_reward_status: Vec<i32>,
    pub include_status: Vec<i32>,
}

pub mod governance_response_types {
    use super::*;

    const EXCHANGE_RATE_TOPIC: i32 = 2;

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

    impl RawProposal for ProposalInfo {
        fn id(&self) -> ProposalId {
            self.id.as_ref().map_or(ProposalId::default(), |p| p.id)
        }

        fn is_excluded(&self) -> bool {
            self.topic == EXCHANGE_RATE_TOPIC
        }
    }

    impl TryFrom<ProposalInfo> for types::Proposal {
        type Error = &'static str;

        fn try_from(p: ProposalInfo) -> Result<Self, Self::Error> {
            let proposal = p.proposal.ok_or("proposal not set")?;

            Ok(types::Proposal {
                id: p.id.ok_or("id not set")?.id,
                proposer: p.proposer.ok_or("proposer not set")?.id,
                title: proposal.title.ok_or("title not set")?,
                summary: proposal.summary,
                url: proposal.url,
                deadline: p.deadline_timestamp_seconds.ok_or("deadline_timestamp_seconds not set")? * 1000,
            })
        }
    }

    #[derive(CandidType, Deserialize)]
    pub struct Proposal {
        pub title: Option<String>,
        pub summary: String,
        pub url: String,
    }
}
