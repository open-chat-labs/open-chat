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
    let updates_since = args.since.unwrap_or_default();
    let last_updated = [
        state.data.tokens.last_updated(),
        state.data.nervous_systems.last_updated(),
        state.data.message_filters.last_updated(),
    ]
    .into_iter()
    .max()
    .unwrap();

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
            message_filters_added: state.data.message_filters.added_since(updates_since),
            message_filters_removed: state.data.message_filters.removed_since(updates_since),
        })
    } else {
        SuccessNoUpdates
    }
}
