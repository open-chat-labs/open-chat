use crate::updates::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::RecordProposalVoteResult;
use group_canister::register_proposal_vote::{Response::*, *};
use ic_cdk_macros::update;
use types::{CanisterId, MessageContentInternal, ProposalId, UserId};

#[update]
#[trace]
async fn register_proposal_vote(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        user_id,
        governance_canister_id,
        proposal_id,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_args = user_canister::c2c_vote_on_proposal::Args {
        governance_canister_id,
        proposal_id,
        adopt: args.adopt,
    };
    match user_canister_c2c_client::c2c_vote_on_proposal(user_id.into(), &c2c_args).await {
        Ok(response) => match response {
            user_canister::c2c_vote_on_proposal::Response::Success => {
                mutate_state(|state| commit(user_id, args, state));
                Success
            }
            user_canister::c2c_vote_on_proposal::Response::NoEligibleNeurons => NoEligibleNeurons,
            user_canister::c2c_vote_on_proposal::Response::ProposalNotFound => ProposalNotFound,
            user_canister::c2c_vote_on_proposal::Response::ProposalNotAcceptingVotes => ProposalNotAcceptingVotes,
            user_canister::c2c_vote_on_proposal::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("{:?}", error)),
    }
}

struct PrepareResult {
    user_id: UserId,
    governance_canister_id: CanisterId,
    proposal_id: ProposalId,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();

    let participant = match runtime_state.data.participants.get_by_principal(&caller) {
        Some(p) => p,
        None => return Err(CallerNotInGroup),
    };

    if let Some(proposal) = runtime_state
        .data
        .events
        .main()
        .message_internal_by_message_index(args.message_index)
        .and_then(|m| if let MessageContentInternal::GovernanceProposal(p) = &m.event.content { Some(p) } else { None })
    {
        if let Some(vote) = proposal.votes.get(&participant.user_id) {
            Err(AlreadyVoted(*vote))
        } else {
            Ok(PrepareResult {
                user_id: participant.user_id,
                governance_canister_id: proposal.governance_canister_id,
                proposal_id: proposal.proposal.id(),
            })
        }
    } else {
        Err(ProposalMessageNotFound)
    }
}

fn commit(user_id: UserId, args: Args, runtime_state: &mut RuntimeState) -> Response {
    let participant = match runtime_state.data.participants.get_by_user_id_mut(&user_id) {
        Some(p) => p,
        None => return CallerNotInGroup,
    };

    match runtime_state
        .data
        .events
        .record_proposal_vote(user_id, args.message_index, args.adopt)
    {
        RecordProposalVoteResult::Success => {
            let now = runtime_state.env.now();
            let votes = participant.proposal_votes.entry(now).or_default();
            if !votes.contains(&args.message_index) {
                votes.push(args.message_index);
            }
            handle_activity_notification(runtime_state);
            Success
        }
        RecordProposalVoteResult::AlreadyVoted(vote) => AlreadyVoted(vote),
        RecordProposalVoteResult::ProposalNotFound => ProposalNotFound,
    }
}
