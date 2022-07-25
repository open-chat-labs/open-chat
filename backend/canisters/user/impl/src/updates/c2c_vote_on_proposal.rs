use crate::governance_clients::nns;
use crate::governance_clients::nns::GetBallotsResult;
use crate::guards::caller_is_owner;
use crate::run_regular_jobs;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use ic_cdk::api::call::CallResult;
use types::{CanisterId, NeuronId, ProposalId};
use user_canister::c2c_vote_on_proposal::{Response::*, *};

#[update_msgpack(guard = "caller_is_owner")]
#[trace]
async fn c2c_vote_on_proposal(args: Args) -> Response {
    run_regular_jobs();

    let ballots = match nns::get_ballots(args.governance_canister_id, args.proposal_id).await {
        Ok(r) => match r {
            GetBallotsResult::Success(b) if !b.is_empty() => b,
            GetBallotsResult::Success(_) => return NoEligibleNeurons,
            GetBallotsResult::ProposalNotFound => return ProposalNotFound,
            GetBallotsResult::ProposalNotAcceptingVotes => return ProposalNotAcceptingVotes,
        },
        Err(error) => return InternalError(format!("{:?}", error)),
    };

    let vote_futures: Vec<_> = ballots
        .into_iter()
        .filter(|(_, vote)| vote.is_none())
        .map(|(neuron_id, _)| register_vote(args.governance_canister_id, neuron_id, args.proposal_id, args.adopt))
        .collect();

    let vote_results = futures::future::join_all(vote_futures).await;

    if let Some(first_error) = vote_results.into_iter().filter_map(|res| res.err()).next() {
        InternalError(format!("{:?}", first_error))
    } else {
        Success
    }
}

async fn register_vote(
    governance_canister_id: CanisterId,
    neuron_id: NeuronId,
    proposal_id: ProposalId,
    adopt: bool,
) -> CallResult<Result<(), nns::GovernanceError>> {
    nns::register_vote(governance_canister_id, neuron_id, proposal_id, adopt).await
}
