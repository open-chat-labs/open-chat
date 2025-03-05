use super::nns::manage_neuron::RegisterVote;
use ic_cdk::call::RejectCode;
use nns_governance_canister::types::{manage_neuron, manage_neuron_response, GovernanceError, ListProposalInfo, ManageNeuron};
use tracing::error;
use types::{CanisterId, NnsNeuronId, ProposalId};

const REWARD_STATUS_ACCEPTING_VOTES: i32 = 1;

pub async fn get_ballots(
    governance_canister_id: CanisterId,
    proposal_id: ProposalId,
) -> Result<GetBallotsResult, (RejectCode, String)> {
    let args = ListProposalInfo {
        limit: 1,
        before_proposal: Some((proposal_id + 1).into()),
        exclude_topic: Vec::new(),
        include_reward_status: Vec::new(),
        include_status: Vec::new(),
        include_all_manage_neuron_proposals: None,
        omit_large_fields: Some(true),
    };

    let response = nns_governance_canister_c2c_client::list_proposals(governance_canister_id, &args).await;

    let result = response?
        .proposal_info
        .into_iter()
        .next()
        .filter(|p| p.id.as_ref().is_some_and(|id| id.id == proposal_id))
        .map(|p| match p.reward_status {
            REWARD_STATUS_ACCEPTING_VOTES => GetBallotsResult::Success(
                p.ballots
                    .into_iter()
                    .map(|(n, b)| {
                        (
                            n,
                            match b.vote {
                                1 => Some(true),
                                2 => Some(false),
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
    Success(Vec<(NnsNeuronId, Option<bool>)>),
    ProposalNotAcceptingVotes,
    ProposalNotFound,
}

pub async fn register_vote(
    governance_canister_id: CanisterId,
    neuron_id: NnsNeuronId,
    proposal_id: ProposalId,
    adopt: bool,
) -> Result<Result<(), GovernanceError>, (RejectCode, String)> {
    let args = ManageNeuron {
        id: Some(neuron_id.into()),
        neuron_id_or_subaccount: None,
        command: Some(manage_neuron::Command::RegisterVote(RegisterVote {
            proposal: Some(proposal_id.into()),
            vote: if adopt { 1 } else { 2 },
        })),
    };

    let response = nns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &args).await?;

    Ok(match response.command {
        Some(manage_neuron_response::Command::RegisterVote(_)) => Ok(()),
        Some(manage_neuron_response::Command::Error(error)) => Err(error),
        Some(_) => unreachable!(),
        None => {
            // This will be reached if we fail to deserialize the response
            // TODO remove this arm once candid is fixed (if ever).
            error!("Failed to deserialize NNS manage_neuron response");
            Ok(())
        }
    })
}
