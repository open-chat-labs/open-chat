use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use registry_canister::c2c_nervous_systems::{Response::*, *};

#[query(msgpack = true)]
#[trace]
fn c2c_nervous_systems(args: Args) -> Response {
    read_state(|state| c2c_nervous_systems_impl(args, state))
}

fn c2c_nervous_systems_impl(args: Args, state: &RuntimeState) -> Response {
    let last_updated = state.data.nervous_systems.last_updated();
    let updates_since = args.updates_since.unwrap_or_default();

    if updates_since < last_updated {
        Success(SuccessResult {
            last_updated,
            nervous_systems: state
                .data
                .nervous_systems
                .get_all()
                .iter()
                .filter(|ns| ns.last_updated > updates_since)
                .cloned()
                .collect(),
        })
    } else {
        SuccessNoUpdates
    }
}
