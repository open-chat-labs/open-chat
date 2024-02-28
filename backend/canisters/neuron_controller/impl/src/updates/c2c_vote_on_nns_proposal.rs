use crate::guards::caller_is_proposals_bot;
use crate::read_state;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use neuron_controller_canister::c2c_vote_on_nns_proposal::{Response::*, *};
use nns_governance_canister::types::manage_neuron::{Command, RegisterVote};
use nns_governance_canister::types::{manage_neuron_response, ManageNeuron, NeuronId, ProposalId};
use tracing::{error, info};

const NNS_NEURON_ID: u64 = 17682165960669268263; // https://dashboard.internetcomputer.org/neuron/17682165960669268263

#[update(guard = "caller_is_proposals_bot")]
#[trace]
async fn c2c_vote_on_nns_proposal(args: Args) -> Response {
    let nns_governance_canister_id = read_state(|state| state.data.nns_governance_canister_id);
    let proposal_id = args.proposal_id;
    let vote = args.vote;

    match nns_governance_canister_c2c_client::manage_neuron(
        nns_governance_canister_id,
        &ManageNeuron {
            id: Some(NeuronId { id: NNS_NEURON_ID }),
            neuron_id_or_subaccount: None,
            command: Some(Command::RegisterVote(RegisterVote {
                proposal: Some(ProposalId { id: proposal_id }),
                vote: if vote { 1 } else { 2 },
            })),
        },
    )
    .await
    {
        Ok(response) => match response.command {
            Some(manage_neuron_response::Command::RegisterVote(_)) => {
                info!(proposal_id, vote, "Voted on NNS proposal");
                Success
            }
            response => {
                error!(proposal_id, vote, ?response, "Failed to vote on NNS proposal");
                InternalError(format!("{response:?}"))
            }
        },
        // TODO retry this
        Err(error) => InternalError(format!("{error:?}")),
    }
}
