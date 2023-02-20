use self::governance_response_types::{ListProposalsResponse, ProposalData};
use super::common::{RawProposal, RawTally, WrappedProposalId};
use candid::CandidType;
use ic_cdk::api::call::CallResult;
use serde::Deserialize;
use tracing::error;
use types::{CanisterId, ProposalDecisionStatus, ProposalId, ProposalRewardStatus, SnsNeuronId};

pub async fn list_proposals(governance_canister_id: CanisterId, args: &ListProposals) -> CallResult<Vec<ProposalData>> {
    let method_name = "list_proposals";
    let response: CallResult<(ListProposalsResponse,)> =
        ic_cdk::api::call::call(governance_canister_id, method_name, (args,)).await;

    if let Err(error) = &response {
        error!(method_name, error_code = ?error.0, error_message = error.1.as_str(), "Error calling c2c");
    }

    response.map(|r| r.0.proposals)
}

#[derive(CandidType, Deserialize, Default)]
pub struct ListProposals {
    pub limit: u32,
    pub before_proposal: Option<WrappedProposalId>,
    pub exclude_type: Vec<u64>,
    pub include_reward_status: Vec<i32>,
    pub include_status: Vec<i32>,
}

pub mod governance_response_types {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct ListProposalsResponse {
        pub proposals: Vec<ProposalData>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct ProposalData {
        pub action: u64,
        pub id: Option<WrappedProposalId>,
        pub proposer: Option<WrappedNeuronId>,
        pub reject_cost_e8s: u64,
        pub proposal: Option<Proposal>,
        pub proposal_creation_timestamp_seconds: u64,
        pub latest_tally: Option<RawTally>,
        pub decided_timestamp_seconds: u64,
        pub executed_timestamp_seconds: u64,
        pub failed_timestamp_seconds: u64,
        pub reward_event_round: u64,
        pub wait_for_quiet_state: Option<WaitForQuietState>,
        pub payload_text_rendering: Option<String>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct WaitForQuietState {
        pub current_deadline_timestamp_seconds: u64,
    }

    impl ProposalData {
        pub fn status(&self) -> ProposalDecisionStatus {
            if self.decided_timestamp_seconds == 0 {
                ProposalDecisionStatus::Open
            } else if self.is_accepted() {
                if self.executed_timestamp_seconds > 0 {
                    ProposalDecisionStatus::Executed
                } else if self.failed_timestamp_seconds > 0 {
                    ProposalDecisionStatus::Failed
                } else {
                    ProposalDecisionStatus::Adopted
                }
            } else {
                ProposalDecisionStatus::Rejected
            }
        }

        pub fn reward_status(&self, now_seconds: u64) -> ProposalRewardStatus {
            match self.reward_event_round {
                0 => {
                    if self.accepts_vote(now_seconds) {
                        ProposalRewardStatus::AcceptVotes
                    } else {
                        ProposalRewardStatus::ReadyToSettle
                    }
                }
                _ => ProposalRewardStatus::Settled,
            }
        }

        fn is_accepted(&self) -> bool {
            // https://github.com/dfinity/ic/blob/17f0bb9bbbde697ebc3675c9d09e69b803d70bf9/rs/sns/governance/src/proposal.rs#L37
            const MIN_NUMBER_VOTES_FOR_PROPOSAL_RATIO: f64 = 0.03;

            if let Some(tally) = self.latest_tally.as_ref() {
                (tally.yes as f64 >= tally.total as f64 * MIN_NUMBER_VOTES_FOR_PROPOSAL_RATIO) && tally.yes > tally.no
            } else {
                false
            }
        }

        fn accepts_vote(&self, now_seconds: u64) -> bool {
            // Checks if the proposal's deadline is still in the future.
            now_seconds < self.get_deadline_timestamp_seconds()
        }

        fn get_deadline_timestamp_seconds(&self) -> u64 {
            self.wait_for_quiet_state
                .as_ref()
                .expect("Proposal must have a wait_for_quiet_state.")
                .current_deadline_timestamp_seconds
        }
    }

    impl RawProposal for ProposalData {
        fn id(&self) -> ProposalId {
            self.id.as_ref().map_or(ProposalId::default(), |p| p.id)
        }
    }

    impl TryFrom<ProposalData> for types::Proposal {
        type Error = &'static str;

        fn try_from(value: ProposalData) -> Result<Self, Self::Error> {
            types::SnsProposal::try_from(value).map(types::Proposal::SNS)
        }
    }

    impl TryFrom<ProposalData> for types::SnsProposal {
        type Error = &'static str;

        fn try_from(p: ProposalData) -> Result<Self, Self::Error> {
            let now = utils::time::now_millis();
            let now_seconds = now / 1000;
            let status = p.status();
            let reward_status = p.reward_status(now_seconds);
            let deadline = p.get_deadline_timestamp_seconds() * 1000;

            let proposal = p.proposal.ok_or("proposal not set")?;

            Ok(types::SnsProposal {
                id: p.id.ok_or("id not set")?.id,
                action: p.action,
                proposer: p.proposer.ok_or("proposer not set")?.id,
                created: p.proposal_creation_timestamp_seconds * 1000,
                title: proposal.title,
                summary: proposal.summary,
                url: proposal.url,
                status,
                reward_status,
                tally: p.latest_tally.map(|t| t.into()).unwrap_or_default(),
                deadline,
                payload_text_rendering: p.payload_text_rendering,
                last_updated: now,
            })
        }
    }

    #[derive(CandidType, Deserialize)]
    pub struct Proposal {
        pub title: String,
        pub summary: String,
        pub url: String,
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub struct WrappedNeuronId {
    pub id: SnsNeuronId,
}
