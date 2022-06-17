use crate::governance_client::GovernanceError;
use crate::guards::caller_is_owner;
use crate::openchat_bot::send_voted_on_proposal_message;
use crate::{governance_client, mutate_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::update;
use types::{CanisterId, NeuronId, ProposalId};
use user_canister::vote_on_proposal::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn vote_on_proposal(args: Args) -> Response {
    run_regular_jobs();

    let mut neuron_ids = match governance_client::get_neuron_ids(args.governance_canister_id).await {
        Ok(n) => n,
        Err(error) => return InternalError(format!("{:?}", error)),
    };
    neuron_ids.sort_unstable();

    let vote_futures: Vec<_> = neuron_ids
        .into_iter()
        .map(|neuron_id| register_vote(args.governance_canister_id, neuron_id, args.proposal_id, args.adopt))
        .collect();

    let vote_results = futures::future::join_all(vote_futures).await;

    let mut voted = Vec::new();
    let mut unable_to_vote = Vec::new();
    let mut errors = Vec::new();
    for (neuron_id, result) in vote_results {
        match result {
            Ok(Ok(_)) => voted.push(neuron_id),
            Ok(Err(error)) => unable_to_vote.push((neuron_id, format!("{error:?}"))),
            Err(error) => errors.push((neuron_id, format!("{error:?}"))),
        }
    }

    mutate_state(|state| {
        send_voted_on_proposal_message(
            args.governance_canister_id,
            args.proposal_id,
            args.adopt,
            voted,
            unable_to_vote,
            errors,
            state,
        );
    });

    Success
}

async fn register_vote(
    governance_canister_id: CanisterId,
    neuron_id: NeuronId,
    proposal_id: ProposalId,
    adopt: bool,
) -> (NeuronId, CallResult<Result<(), GovernanceError>>) {
    let response = governance_client::register_vote(governance_canister_id, neuron_id, proposal_id, adopt).await;
    (neuron_id, response)
}
