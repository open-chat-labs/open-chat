use self::governance_response_types::{ListProposalInfoResponse, ProposalInfo};
use super::common::{RawProposal, RawTally, WrappedProposalId};
use candid::CandidType;
use ic_cdk::api::call::CallResult;
use serde::Deserialize;
use tracing::error;
use types::{CanisterId, NnsNeuronId, ProposalId};

pub const TOPIC_NEURON_MANAGEMENT: i32 = 1;
pub const TOPIC_EXCHANGE_RATE: i32 = 2;

pub async fn list_proposals(governance_canister_id: CanisterId, args: &ListProposalInfo) -> CallResult<Vec<ProposalInfo>> {
    let method_name = "list_proposals";
    let response: CallResult<(ListProposalInfoResponse,)> =
        ic_cdk::api::call::call(governance_canister_id, method_name, (args,)).await;

    if let Err(error) = &response {
        error!(method_name, error_code = ?error.0, error_message = error.1.as_str(), "Error calling c2c");
    }

    response.map(|r| r.0.proposal_info)
}

#[derive(CandidType, Deserialize, Default)]
pub struct ListProposalInfo {
    pub limit: u32,
    pub before_proposal: Option<WrappedProposalId>,
    pub exclude_topic: Vec<i32>,
    pub include_reward_status: Vec<i32>,
    pub include_status: Vec<i32>,
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
        pub proposer: Option<WrappedNeuronId>,
        pub reject_cost_e8s: u64,
        pub proposal: Option<Proposal>,
        pub proposal_timestamp_seconds: u64,
        pub latest_tally: Option<RawTally>,
        pub decided_timestamp_seconds: u64,
        pub executed_timestamp_seconds: u64,
        pub failed_timestamp_seconds: u64,
        pub reward_event_round: u64,
        pub topic: i32,
        pub status: i32,
        pub reward_status: i32,
        pub deadline_timestamp_seconds: Option<u64>,
    }

    impl RawProposal for ProposalInfo {
        fn id(&self) -> ProposalId {
            self.id.as_ref().map_or(ProposalId::default(), |p| p.id)
        }
    }

    impl TryFrom<ProposalInfo> for types::Proposal {
        type Error = &'static str;

        fn try_from(value: ProposalInfo) -> Result<Self, Self::Error> {
            types::NnsProposal::try_from(value).map(types::Proposal::NNS)
        }
    }

    impl TryFrom<ProposalInfo> for types::NnsProposal {
        type Error = &'static str;

        fn try_from(p: ProposalInfo) -> Result<Self, Self::Error> {
            let proposal = p.proposal.ok_or("proposal not set")?;
            let now = utils::time::now_millis();

            Ok(types::NnsProposal {
                id: p.id.ok_or("id not set")?.id,
                topic: p.topic,
                proposer: p.proposer.ok_or("proposer not set")?.id,
                created: p.proposal_timestamp_seconds * 1000,
                title: proposal.title.ok_or("title not set")?,
                summary: proposal.summary,
                url: proposal.url,
                status: p.status.try_into().unwrap(),
                reward_status: p.reward_status.try_into().unwrap(),
                tally: p.latest_tally.map(|t| t.into()).unwrap_or_default(),
                deadline: p.deadline_timestamp_seconds.ok_or("deadline not set")? * 1000,
                last_updated: now,
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

#[derive(CandidType, Deserialize, Clone)]
pub struct WrappedNeuronId {
    pub id: NnsNeuronId,
}
