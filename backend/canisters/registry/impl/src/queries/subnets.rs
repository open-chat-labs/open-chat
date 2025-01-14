use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::query;
use registry_canister::subnets::{Response::*, *};

#[query]
#[trace]
fn subnets(_args: Args) -> Response {
    read_state(subnets_impl)
}

fn subnets_impl(state: &RuntimeState) -> Response {
    Success(state.data.subnets.subnets().to_vec())
}
