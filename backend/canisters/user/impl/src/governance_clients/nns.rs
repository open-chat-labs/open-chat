use super::nns::manage_neuron::RegisterVote;
use candid::CandidType;
use ic_cdk::api::call::CallResult;
use serde::Deserialize;
use std::collections::HashMap;
use types::{CanisterId, NeuronId, ProposalId, Vote};

const REWARD_STATUS_ACCEPTING_VOTES: i32 = 1;

pub async fn get_ballots(governance_canister_id: CanisterId, proposal_id: ProposalId) -> CallResult<GetBallotsResult> {
    let args = list_proposals::ListProposalInfo {
        limit: 1,
        before_proposal: Some(WrappedProposalId { id: proposal_id + 1 }),
        exclude_topic: Vec::new(),
        include_reward_status: Vec::new(),
        include_status: Vec::new(),
    };

    let response: CallResult<(list_proposals::ListProposalInfoResponse,)> =
        ic_cdk::call(governance_canister_id, "list_proposals", (&args,)).await;

    let result = response?
        .0
        .proposal_info
        .into_iter()
        .next()
        .filter(|p| p.id.as_ref().map_or(false, |id| id.id == proposal_id))
        .map(|p| match p.reward_status {
            REWARD_STATUS_ACCEPTING_VOTES => GetBallotsResult::Success(
                p.ballots
                    .into_iter()
                    .map(|(n, b)| {
                        (
                            n,
                            match b.vote {
                                1 => Some(Vote::Yes),
                                2 => Some(Vote::No),
                                _ => None,
                            },
                        )
                    })
                    .collect(),
            ),
            _ => GetBallotsResult::ProposalNotAcceptingVotes,
        })
        .unwrap_or(GetBallotsResult::ProposalNotFound);

    Ok(result)
}

pub enum GetBallotsResult {
    Success(Vec<(NeuronId, Option<Vote>)>),
    ProposalNotAcceptingVotes,
    ProposalNotFound,
}

pub async fn register_vote(
    governance_canister_id: CanisterId,
    neuron_id: u64,
    proposal_id: u64,
    vote: Vote,
) -> CallResult<Result<(), GovernanceError>> {
    let args = ManageNeuron {
        neuron_id_or_subaccount: Some(manage_neuron::NeuronIdOrSubaccount::NeuronId(neuron_id.into())),
        command: Some(manage_neuron::Command::RegisterVote(RegisterVote {
            proposal: Some(proposal_id.into()),
            vote: if matches!(vote, Vote::Yes) { 1 } else { 2 },
        })),
    };
    let (response,): (ManageNeuronResponse,) = ic_cdk::call(governance_canister_id, "manage_neuron", (&args,)).await?;
    Ok(match response.command.unwrap() {
        manage_neuron_response::Command::RegisterVote(_) => Ok(()),
        manage_neuron_response::Command::Error(error) => Err(error),
        _ => unreachable!(),
    })
}

mod list_proposals {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct ListProposalInfo {
        pub limit: u32,
        pub before_proposal: Option<WrappedProposalId>,
        pub exclude_topic: Vec<i32>,
        pub include_reward_status: Vec<i32>,
        pub include_status: Vec<i32>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct ListProposalInfoResponse {
        pub proposal_info: Vec<ProposalInfo>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct ProposalInfo {
        pub id: Option<WrappedProposalId>,
        pub ballots: HashMap<u64, Ballot>,
        pub reward_status: i32,
    }

    #[derive(CandidType, Deserialize)]
    pub struct Ballot {
        pub vote: i32,
    }
}

#[derive(CandidType, Deserialize)]
struct ManageNeuron {
    pub neuron_id_or_subaccount: Option<manage_neuron::NeuronIdOrSubaccount>,
    pub command: Option<manage_neuron::Command>,
}

mod manage_neuron {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct RegisterVote {
        pub proposal: Option<WrappedProposalId>,
        pub vote: i32,
    }

    #[derive(CandidType, Deserialize)]
    pub enum NeuronIdOrSubaccount {
        NeuronId(WrappedNeuronId),
    }

    #[derive(CandidType, Deserialize)]
    pub enum Command {
        RegisterVote(RegisterVote),
    }
}

#[derive(CandidType, Deserialize)]
struct ManageNeuronResponse {
    pub command: Option<manage_neuron_response::Command>,
}

mod manage_neuron_response {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct ConfigureResponse {}

    #[derive(CandidType, Deserialize)]
    pub struct DisburseResponse {
        pub transfer_block_height: u64,
    }

    #[derive(CandidType, Deserialize)]
    pub struct SpawnResponse {
        pub created_neuron_id: Option<WrappedNeuronId>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct MergeMaturityResponse {
        pub merged_maturity_e8s: u64,
        pub new_stake_e8s: u64,
    }

    #[derive(CandidType, Deserialize)]
    pub struct FollowResponse {}

    #[derive(CandidType, Deserialize)]
    pub struct MakeProposalResponse {
        pub proposal_id: Option<WrappedProposalId>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct RegisterVoteResponse {}

    #[derive(CandidType, Deserialize)]
    pub struct SplitResponse {
        pub created_neuron_id: Option<WrappedNeuronId>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct MergeResponse {}

    #[derive(CandidType, Deserialize)]
    pub struct DisburseToNeuronResponse {
        pub created_neuron_id: Option<WrappedNeuronId>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct ClaimOrRefreshResponse {
        pub refreshed_neuron_id: Option<WrappedNeuronId>,
    }

    #[derive(CandidType, Deserialize)]
    pub enum Command {
        Error(super::GovernanceError),
        Configure(ConfigureResponse),
        Disburse(DisburseResponse),
        Spawn(SpawnResponse),
        Follow(FollowResponse),
        MakeProposal(MakeProposalResponse),
        RegisterVote(RegisterVoteResponse),
        Split(SplitResponse),
        DisburseToNeuron(DisburseToNeuronResponse),
        ClaimOrRefresh(ClaimOrRefreshResponse),
        MergeMaturity(MergeMaturityResponse),
        Merge(MergeResponse),
    }
}

#[derive(CandidType, Deserialize, Debug)]
pub struct GovernanceError {
    pub error_type: i32,
    pub error_message: String,
}

#[derive(CandidType, Deserialize)]
pub struct WrappedNeuronId {
    pub id: NeuronId,
}

impl From<u64> for WrappedNeuronId {
    fn from(id: u64) -> Self {
        WrappedNeuronId { id }
    }
}

#[derive(CandidType, Deserialize)]
pub struct WrappedProposalId {
    pub id: ProposalId,
}

impl From<u64> for WrappedProposalId {
    fn from(id: u64) -> Self {
        WrappedProposalId { id }
    }
}
