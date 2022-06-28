use crate::governance_client::manage_neuron::RegisterVote;
use candid::CandidType;
use ic_cdk::api::call::CallResult;
use serde::Deserialize;
use types::{CanisterId, NeuronId, ProposalId};

pub async fn get_neuron_ids(governance_canister_id: CanisterId) -> CallResult<Vec<NeuronId>> {
    let response: CallResult<(Vec<NeuronId>,)> = ic_cdk::call(governance_canister_id, "get_neuron_ids", ()).await;
    response.map(|r| r.0)
}

pub async fn register_vote(
    governance_canister_id: CanisterId,
    neuron_id: u64,
    proposal_id: u64,
    adopt: bool,
) -> CallResult<Result<(), GovernanceError>> {
    let args = ManageNeuron {
        neuron_id_or_subaccount: Some(manage_neuron::NeuronIdOrSubaccount::NeuronId(neuron_id.into())),
        command: Some(manage_neuron::Command::RegisterVote(RegisterVote {
            proposal: Some(proposal_id.into()),
            vote: if adopt { 1 } else { 2 },
        })),
    };
    let (response,): (ManageNeuronResponse,) = ic_cdk::call(governance_canister_id, "manage_neuron", (&args,)).await?;
    Ok(match response.command.unwrap() {
        manage_neuron_response::Command::RegisterVote(_) => Ok(()),
        manage_neuron_response::Command::Error(error) => Err(error),
        _ => unreachable!(),
    })
}

#[derive(CandidType, Deserialize)]
pub struct ManageNeuron {
    pub neuron_id_or_subaccount: Option<manage_neuron::NeuronIdOrSubaccount>,
    pub command: Option<manage_neuron::Command>,
}

pub mod manage_neuron {
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
pub struct ManageNeuronResponse {
    pub command: Option<manage_neuron_response::Command>,
}

pub mod manage_neuron_response {
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
