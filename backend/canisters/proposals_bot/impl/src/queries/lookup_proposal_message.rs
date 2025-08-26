use crate::{RuntimeState, read_state};
use ic_cdk::query;
use proposals_bot_canister::lookup_proposal_message::{Response::*, *};

#[query]
fn lookup_proposal_message(args: Args) -> Response {
    read_state(|state| lookup_proposal_message_impl(args, state))
}

fn lookup_proposal_message_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(ns) = state.data.nervous_systems.get(&args.governance_canister_id)
        && let Some((message_index, message_id)) = ns.proposal_message(&args.proposal_id)
    {
        return Success(SuccessResult {
            chat_id: ns.chat_id(),
            message_index,
            message_id,
        });
    }
    NotFound
}
