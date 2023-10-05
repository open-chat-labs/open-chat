use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use registry_canister::add_named_neuron::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn add_named_neuron(args: Args) -> Response {
    mutate_state(|state| add_named_neuron_impl(args, state))
}

fn add_named_neuron_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state
        .data
        .named_neurons
        .push(args.governance_canister_id, args.neuron_id, args.name, now);

    Success
}
