use crate::governance_clients::nns;
use crate::governance_clients::nns::GetBallotsResult;
use crate::guards::caller_is_owner;
use crate::openchat_bot::send_voted_on_proposal_message;
use crate::{mutate_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::update;
use types::{CanisterId, NeuronId, ProposalId, Vote};
use user_canister::vote_on_proposal::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn vote_on_proposal(args: Args) -> Response {
    run_regular_jobs();

    let mut ballots = match nns::get_ballots(args.governance_canister_id, args.proposal_id).await {
        Ok(r) => match r {
            GetBallotsResult::Success(b) if !b.is_empty() => b,
            GetBallotsResult::Success(_) => return NoEligibleNeurons,
            GetBallotsResult::ProposalNotFound => return ProposalNotFound,
            GetBallotsResult::ProposalNotAcceptingVotes => return ProposalNotAcceptingVotes,
        },
        Err(error) => return InternalError(format!("{:?}", error)),
    };
    ballots.sort_unstable_by_key(|(n, _)| *n);

    let vote_futures: Vec<_> = ballots
        .into_iter()
        .filter(|(_, vote)| vote.is_none())
        .map(|(neuron_id, _)| register_vote(args.governance_canister_id, neuron_id, args.proposal_id, args.vote))
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
            args.vote,
            &voted,
            &unable_to_vote,
            &errors,
            state,
        );

        if errors.is_empty() {
            if let Some(group_chat) = state.data.group_chats.get_mut(&args.chat_id) {
                let now = state.env.now();
                group_chat.record_proposal_vote(args.message_index, now);
            }
        }
    });

    Success
}

async fn register_vote(
    governance_canister_id: CanisterId,
    neuron_id: NeuronId,
    proposal_id: ProposalId,
    vote: Vote,
) -> (NeuronId, CallResult<Result<(), nns::GovernanceError>>) {
    let response = nns::register_vote(governance_canister_id, neuron_id, proposal_id, vote).await;
    (neuron_id, response)
}
