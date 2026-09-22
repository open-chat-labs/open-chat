use crate::guards::caller_is_known_group_or_community_canister;
use crate::{execute_update_async, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_vote_on_proposal::{Response::*, *};

#[update(guard = "caller_is_known_group_or_community_canister", msgpack = true)]
#[trace]
async fn c2c_vote_on_proposal(args: Args) -> Response {
    execute_update_async(|| c2c_vote_on_proposal_impl(args)).await
}

async fn c2c_vote_on_proposal_impl(args: Args) -> Response {
    let (canister_id, now) = read_state(|state| (state.env.canister_id(), state.env.now()));

    match governance_clients::vote_on_proposal(
        args.is_nns,
        args.governance_canister_id,
        args.proposal_id,
        args.adopt,
        canister_id,
        now,
    )
    .await
    {
        Ok(()) => Success,
        Err(error) => Error(error),
    }
}
