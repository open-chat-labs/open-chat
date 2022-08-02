use crate::governance_clients::sns::manage_neuron::RegisterVote;
use candid::{CandidType, Principal};
use ic_cdk::api::call::CallResult;
use serde::Deserialize;
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
        .map(|n| n.id.id)
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
    Ok(match response.command.unwrap() {
        manage_neuron_response::Command::RegisterVote(_) => Ok(()),
        manage_neuron_response::Command::Error(error) => Err(error),
        _ => unreachable!(),
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
        pub id: WrappedNeuronId,
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
    pub struct ConfigureResponse {}

    #[derive(CandidType, Deserialize, Debug)]
    pub struct DisburseResponse {
        pub transfer_block_height: u64,
    }

    #[derive(CandidType, Deserialize, Debug)]
    pub struct MergeMaturityResponse {
        pub merged_maturity_e8s: u64,
        pub new_stake_e8s: u64,
    }

    #[derive(CandidType, Deserialize, Debug)]
    pub struct DisburseMaturityResponse {
        pub transfer_block_height: u64,
        pub amount_disbursed_e8s: u64,
    }

    #[derive(CandidType, Deserialize, Debug)]
    pub struct FollowResponse {}

    #[derive(CandidType, Deserialize, Debug)]
    pub struct MakeProposalResponse {
        pub proposal_id: Option<WrappedProposalId>,
    }

    #[derive(CandidType, Deserialize, Debug)]
    pub struct RegisterVoteResponse {}

    #[derive(CandidType, Deserialize, Debug)]
    pub struct SplitResponse {
        pub created_neuron_id: Option<WrappedNeuronId>,
    }

    #[derive(CandidType, Deserialize, Debug)]
    pub struct ClaimOrRefreshResponse {
        pub refreshed_neuron_id: Option<WrappedNeuronId>,
    }

    #[derive(CandidType, Deserialize, Debug)]
    pub struct AddNeuronPermissionsResponse {}

    #[derive(CandidType, Deserialize, Debug)]
    pub struct RemoveNeuronPermissionsResponse {}

    #[derive(CandidType, Deserialize, Debug)]
    pub enum Command {
        Error(super::GovernanceError),
        Configure(ConfigureResponse),
        Disburse(DisburseResponse),
        Follow(FollowResponse),
        MakeProposal(MakeProposalResponse),
        RegisterVote(RegisterVoteResponse),
        Split(SplitResponse),
        ClaimOrRefresh(ClaimOrRefreshResponse),
        MergeMaturity(MergeMaturityResponse),
        DisburseMaturity(DisburseMaturityResponse),
        AddNeuronPermission(AddNeuronPermissionsResponse),
        RemoveNeuronPermission(RemoveNeuronPermissionsResponse),
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
