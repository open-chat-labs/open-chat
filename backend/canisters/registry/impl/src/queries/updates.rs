use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::query;
use registry_canister::updates::{Response::*, *};

#[query]
#[trace]
fn updates(args: Args) -> Response {
    read_state(|state| updates_impl(args, state))
}

fn updates_impl(args: Args, state: &RuntimeState) -> Response {
    let last_updated = state.data.tokens.last_updated();

    if args.since.map_or(true, |since| since < last_updated) {
        Success(SuccessResult {
            last_updated,
            token_details: Some(state.data.tokens.get_all().to_vec()),
        })
    } else {
        SuccessNoUpdates
    }
}
