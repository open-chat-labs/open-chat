use crate::governance_clients::sns::manage_neuron::RegisterVote;
use candid::Principal;
use ic_cdk::api::call::CallResult;
use sns_governance_canister::types::neuron::DissolveState;
use sns_governance_canister::types::{manage_neuron, manage_neuron_response, GovernanceError};
use tracing::error;
use types::{CanisterId, ProposalId, SnsNeuronId, TimestampMillis};

pub async fn list_neurons(
    governance_canister_id: CanisterId,
    limit: u32,
    of_principal: Principal,
    now: TimestampMillis,
) -> CallResult<Vec<SnsNeuronId>> {
    let args = sns_governance_canister::list_neurons::Args {
        limit,
        start_page_at: None,
        of_principal: Some(of_principal.into()),
    };

    let response = sns_governance_canister_c2c_client::list_neurons(governance_canister_id, &args).await?;

    let neuron_ids = response
        .neurons
        .into_iter()
        .filter(|n| n.dissolve_state.as_ref().map_or(false, |d| !is_dissolved(d, now)))
        .filter_map(|n| n.id)
        .filter_map(|n| n.id.try_into().ok())
        .collect();

    Ok(neuron_ids)
}

pub async fn register_vote(
    governance_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    proposal_id: ProposalId,
    adopt: bool,
) -> CallResult<Result<(), GovernanceError>> {
    let args = sns_governance_canister::manage_neuron::Args {
        subaccount: neuron_id.to_vec(),
        command: Some(manage_neuron::Command::RegisterVote(RegisterVote {
            proposal: Some(sns_governance_canister::types::ProposalId { id: proposal_id }),
            vote: if adopt { 1 } else { 2 },
        })),
    };

    let response = sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &args).await?;

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

fn is_dissolved(state: &DissolveState, now: TimestampMillis) -> bool {
    match state {
        DissolveState::WhenDissolvedTimestampSeconds(secs) => *secs * 1000 < now,
        DissolveState::DissolveDelaySeconds(secs) => *secs == 0,
    }
}
