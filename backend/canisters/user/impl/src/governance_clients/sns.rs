use crate::governance_clients::sns::manage_neuron::RegisterVote;
use candid::{CandidType, Principal};
use ic_cdk::api::call::CallResult;
use serde::Deserialize;
use tracing::error;
use types::{CanisterId, ProposalId, SnsNeuronId, TimestampMillis};

pub async fn list_neurons(
    governance_canister_id: CanisterId,
    limit: u32,
    of_principal: Principal,
    now: TimestampMillis,
) -> CallResult<Vec<SnsNeuronId>> {
    let args = list_neurons::ListNeurons {
        limit,
        of_principal: Some(of_principal),
    };

    let response: CallResult<(list_neurons::ListNeuronsResponse,)> =
        ic_cdk::call(governance_canister_id, "list_neurons", (&args,)).await;

    let neuron_ids = response?
        .0
        .neurons
        .into_iter()
        .filter(|n| n.dissolve_state.as_ref().map_or(false, |d| !d.is_dissolved(now)))
        .filter_map(|n| n.id)
        .map(|n| n.id)
        .collect();

    Ok(neuron_ids)
}

pub async fn register_vote(
    governance_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    proposal_id: ProposalId,
    adopt: bool,
) -> CallResult<Result<(), GovernanceError>> {
    let args = ManageNeuron {
        subaccount: neuron_id.to_vec(),
        command: Some(manage_neuron::Command::RegisterVote(RegisterVote {
            proposal: Some(proposal_id.into()),
            vote: if adopt { 1 } else { 2 },
        })),
    };
    let (response,): (ManageNeuronResponse,) = ic_cdk::call(governance_canister_id, "manage_neuron", (&args,)).await?;
    Ok(match response.command {
        Some(manage_neuron_response::Command::RegisterVote(_)) => Ok(()),
        Some(manage_neuron_response::Command::Error(error)) => Err(error),
        Some(_) => unreachable!(),
        None => {
            // This will be reached if we fail to deserialize the response
            // TODO remove this arm once candid is fixed (if ever).
            error!(%governance_canister_id, "Failed to deserialize SNS manage_neuron response");
            Ok(())
        }
    })
}

mod list_neurons {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct ListNeurons {
        pub limit: u32,
        pub of_principal: Option<Principal>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct ListNeuronsResponse {
        pub neurons: Vec<Neuron>,
    }

    #[derive(CandidType, Deserialize)]
    pub struct Neuron {
        pub id: Option<WrappedNeuronId>,
        pub dissolve_state: Option<DissolveState>,
    }

    #[derive(CandidType, Deserialize)]
    pub enum DissolveState {
        WhenDissolvedTimestampSeconds(u64),
        DissolveDelaySeconds(u64),
    }

    impl DissolveState {
        pub fn is_dissolved(&self, now: TimestampMillis) -> bool {
            match self {
                DissolveState::WhenDissolvedTimestampSeconds(secs) => *secs * 1000 < now,
                DissolveState::DissolveDelaySeconds(secs) => *secs == 0,
            }
        }
    }
}

#[derive(CandidType, Deserialize)]
pub struct ManageNeuron {
    pub subaccount: Vec<u8>,
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

    #[derive(CandidType, Deserialize, Debug)]
    pub struct Empty {}

    #[derive(CandidType, Deserialize, Debug)]
    pub enum Command {
        Error(GovernanceError),
        Configure(Empty),
        Disburse(Empty),
        Follow(Empty),
        MakeProposal(Empty),
        RegisterVote(Empty),
        Split(Empty),
        ClaimOrRefresh(Empty),
        MergeMaturity(Empty),
        DisburseMaturity(Empty),
        AddNeuronPermission(Empty),
        RemoveNeuronPermission(Empty),
    }
}

#[derive(CandidType, Deserialize, Debug)]
pub struct GovernanceError {
    pub error_type: i32,
    pub error_message: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct WrappedNeuronId {
    pub id: SnsNeuronId,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct WrappedProposalId {
    pub id: ProposalId,
}

impl From<u64> for WrappedProposalId {
    fn from(id: u64) -> Self {
        WrappedProposalId { id }
    }
}
