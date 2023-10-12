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
    let updates_since = args.since.unwrap_or_default();
    let last_updated = max(state.data.tokens.last_updated(), state.data.nervous_systems.last_updated());

    if updates_since < last_updated {
        Success(SuccessResult {
            last_updated,
            token_details: Some(state.data.tokens.get_all().to_vec()),
            nervous_system_details: state
                .data
                .nervous_systems
                .get_all()
                .iter()
                .filter(|ns| ns.last_updated > updates_since)
                .map(|ns| ns.into())
                .collect(),
        })
    } else {
        SuccessNoUpdates
    }
}
