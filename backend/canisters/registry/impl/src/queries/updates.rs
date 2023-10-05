use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::query;
use registry_canister::updates::{Response::*, *};
use std::cmp::max;

#[query]
#[trace]
fn updates(args: Args) -> Response {
    read_state(|state| updates_impl(args, state))
}

fn updates_impl(args: Args, state: &RuntimeState) -> Response {
    let last_updated = max(state.data.tokens.last_updated(), state.data.named_neurons.last_updated());
    let since = args.since.unwrap_or_default();

    if since < last_updated {
        Success(SuccessResult {
            last_updated,
            token_details: Some(state.data.tokens.get_all().to_vec()),
            named_neurons: state.data.named_neurons.updated_since(since),
        })
    } else {
        SuccessNoUpdates
    }
}
