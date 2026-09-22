//! Clients for the NNS and SNS governance canisters, and voting on a proposal with every neuron a
//! canister controls, shared by the User and MultiUser canisters

pub mod nns;
pub mod sns;

use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, ProposalId, TimestampMillis};

// Votes on the proposal with each of `voter`'s neurons which hasn't voted yet. `voter` is the
// principal the neurons are controlled by or hot-keyed to, which is the canister's.
pub async fn vote_on_proposal(
    is_nns: bool,
    governance_canister_id: CanisterId,
    proposal_id: ProposalId,
    adopt: bool,
    voter: CanisterId,
    now: TimestampMillis,
) -> OCResult {
    if is_nns {
        vote_on_nns_proposal(governance_canister_id, proposal_id, adopt).await
    } else {
        vote_on_sns_proposal(governance_canister_id, proposal_id, adopt, voter, now).await
    }
}

async fn vote_on_nns_proposal(governance_canister_id: CanisterId, proposal_id: ProposalId, adopt: bool) -> OCResult {
    let ballots = match nns::get_ballots(governance_canister_id, proposal_id).await? {
        nns::GetBallotsResult::Success(b) if !b.is_empty() => b,
        nns::GetBallotsResult::Success(_) => return Err(OCErrorCode::NoEligibleNeurons.into()),
        nns::GetBallotsResult::ProposalNotFound => return Err(OCErrorCode::ProposalNotFound.into()),
        nns::GetBallotsResult::ProposalNotAcceptingVotes => return Err(OCErrorCode::ProposalNotAcceptingVotes.into()),
    };

    let vote_futures: Vec<_> = ballots
        .into_iter()
        .filter(|(_, vote)| vote.is_none())
        .map(|(neuron_id, _)| nns::register_vote(governance_canister_id, neuron_id, proposal_id, adopt))
        .collect();

    futures::future::try_join_all(vote_futures).await?;
    Ok(())
}

async fn vote_on_sns_proposal(
    governance_canister_id: CanisterId,
    proposal_id: ProposalId,
    adopt: bool,
    voter: CanisterId,
    now: TimestampMillis,
) -> OCResult {
    let neuron_ids = match sns::list_neurons(governance_canister_id, 10, voter, now).await? {
        n if n.is_empty() => return Err(OCErrorCode::NoEligibleNeurons.into()),
        n => n,
    };

    let vote_futures: Vec<_> = neuron_ids
        .into_iter()
        .map(|neuron_id| sns::register_vote(governance_canister_id, neuron_id, proposal_id, adopt))
        .collect();

    futures::future::try_join_all(vote_futures).await?;
    Ok(())
}
