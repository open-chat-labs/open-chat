use crate::governance_clients::nns;
use crate::guards::caller_is_owner;
use crate::openchat_bot::send_voted_on_proposal_message;
use crate::{mutate_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::update;
use types::{CanisterId, ChatId, MessageId, NeuronId, ProposalId};
use user_canister::vote_on_proposal::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn vote_on_proposal(args: Args) -> Response {
    run_regular_jobs();

    let mut ballots = match nns::get_ballots(args.governance_canister_id, args.proposal_id).await {
        Ok(b) => b,
        Err(error) => return InternalError(format!("{:?}", error)),
    };
    ballots.sort_unstable_by_key(|(n, _)| *n);

    let vote_futures: Vec<_> = ballots
        .into_iter()
        .filter(|(_, vote)| vote.is_none())
        .map(|(neuron_id, _)| register_vote(args.governance_canister_id, neuron_id, args.proposal_id, args.adopt))
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
            &voted,
            &unable_to_vote,
            &errors,
            state,
        );
    });

    if !voted.is_empty() {
        ic_cdk::spawn(register_vote_in_group(args.chat_id, args.message_id, args.adopt));
    }

    Success
}

async fn register_vote(
    governance_canister_id: CanisterId,
    neuron_id: NeuronId,
    proposal_id: ProposalId,
    adopt: bool,
) -> (NeuronId, CallResult<Result<(), nns::GovernanceError>>) {
    let response = nns::register_vote(governance_canister_id, neuron_id, proposal_id, adopt).await;
    (neuron_id, response)
}

async fn register_vote_in_group(chat_id: ChatId, message_id: MessageId, adopt: bool) {
    let c2c_args = group_canister::c2c_register_proposal_vote::Args { message_id, adopt };
    let _ = group_canister_c2c_client::c2c_register_proposal_vote(chat_id.into(), &c2c_args).await;
}
