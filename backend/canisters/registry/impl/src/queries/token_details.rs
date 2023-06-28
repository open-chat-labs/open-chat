use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::query;
use registry_canister::token_details::{Response::*, *};

#[query]
#[trace]
fn token_details(args: Args) -> Response {
    read_state(|state| token_details_impl(args, state))
}

fn token_details_impl(args: Args, state: &RuntimeState) -> Response {
    let token_details = state
        .data
        .tokens
        .get(args.ledger_canister_ids.map(|v| v.into_iter().collect()));

    Success(SuccessResult { token_details })
}
