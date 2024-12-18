use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use registry_canister::subnets::{Response::*, *};

#[query(msgpack = true)]
#[trace]
fn subnets(_args: Args) -> Response {
    read_state(subnets_impl)
}

fn subnets_impl(state: &RuntimeState) -> Response {
    Success(state.data.subnets.subnets().to_vec())
}
