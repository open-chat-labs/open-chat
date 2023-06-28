use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::query;
use registry_canister::version::{Response::*, *};

#[query]
#[trace]
fn version(_args: Args) -> Response {
    read_state(version_impl)
}

fn version_impl(state: &RuntimeState) -> Response {
    Success(SuccessResult {
        version: state.data.version,
    })
}
